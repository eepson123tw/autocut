# api.py
# 修正版本

import os
import uuid
import shutil
from typing import List, Optional
from fastapi import FastAPI, File, UploadFile, BackgroundTasks, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn
import logging
from pathlib import Path

import warnings
import torch

# Add this before your FastAPI app initialization
# This helps with torch hub loading compatibility
warnings.filterwarnings("ignore", category=UserWarning)
torch.hub.set_dir("./torch_hub_cache")  # Set a specific cache directory

# 載入環境變數
from dotenv import load_dotenv
load_dotenv() 

# 設定日誌
logging.basicConfig(
    format="[autocut-api:%(filename)s:L%(lineno)d] %(levelname)-6s %(message)s"
)
logger = logging.getLogger("autocut-api")
logger.setLevel(logging.INFO)

# 創建 FastAPI 應用
app = FastAPI(
    title="AutoCut API",
    description="API for transcribing and cutting videos based on subtitles",
    version="1.0.0",
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生產環境中應限制來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 儲存上傳檔案和處理結果的目錄
UPLOAD_DIR = Path("./uploads")
RESULTS_DIR = Path("./results")
UPLOAD_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(exist_ok=True)

# 任務狀態追蹤
tasks = {}

# 資料模型定義
class TaskStatus(BaseModel):
    id: str
    status: str  # "pending", "processing", "completed", "failed"
    progress: Optional[float] = 0.0
    result_url: Optional[str] = None
    error: Optional[str] = None

class TranscribeRequest(BaseModel):
    lang: str = "zh"
    whisper_mode: str = "whisper"  # 直接使用字串而非列舉值，避免導入問題
    whisper_model: str = "small"  # 直接使用字串而非列舉值，避免導入問題
    prompt: str = ""
    openai_rpm: int = 3
    device: Optional[str] = None
    vad: str = "auto"

class CutRequest(BaseModel):
    bitrate: str = "10m"
    srt_file_id: Optional[str] = None  # 如果已經有 SRT 檔案的 ID

class ConvertSrtRequest(BaseModel):
    format: str  # "md" or "compact"
    encoding: str = "utf-8"

# 輔助函數
def get_file_path(file_id: str) -> Path:
    """根據檔案 ID 獲取檔案路徑"""
    for root in [UPLOAD_DIR, RESULTS_DIR]:
        for path in root.glob(f"**/{file_id}*"):
            return path
    raise HTTPException(status_code=404, detail=f"找不到 ID 為 {file_id} 的檔案")

def update_task_status(task_id: str, status: str, progress: float = None, result_url: str = None, error: str = None):
    """更新任務狀態"""
    if task_id in tasks:
        if progress is not None:
            tasks[task_id]["progress"] = progress
        if status is not None:
            tasks[task_id]["status"] = status
        if result_url is not None:
            tasks[task_id]["result_url"] = result_url
        if error is not None:
            tasks[task_id]["error"] = error
    else:
        tasks[task_id] = {
            "id": task_id,
            "status": status,
            "progress": progress or 0.0,
            "result_url": result_url,
            "error": error
        }

# 後台任務處理函數
async def process_transcribe(task_id: str, file_path: Path, request: TranscribeRequest):
    """處理轉錄任務"""
    try:
        update_task_status(task_id, "processing", 0.1)

        # Fix for torch serialization issues
        torch.serialization.add_safe_globals(['_rebuild_tensor_v2'])
        
        # Fix for torch.storage.UntypedStorage loading issue
        torch.serialization.default_restore_location = lambda storage, loc: storage
        
        # 確保任務輸出目錄存在
        output_dir = RESULTS_DIR / task_id
        output_dir.mkdir(exist_ok=True)
        
        # 在這裡延遲導入 Transcribe，避免導入問題
        from autocut.transcribe import Transcribe
        from autocut.type import WhisperMode, WhisperModel
        
        # 檢查 OpenAI API 金鑰
        if request.whisper_mode == "openai" and not os.environ.get("OPENAI_API_KEY"):
            raise Exception("使用 OpenAI 模式時需要設置 OPENAI_API_KEY 環境變數")
        
        # 強制設置為單一段落處理，避免多處理器問題
        # 此處設置 vad="0" 會使 _detect_voice_activity 方法返回單一段落
        # 避免了 WhisperModel.transcribe 中的多處理器路徑
        vad_setting = request.vad
        if request.device == "cpu":
            vad_setting = "0"  # Force single segment on CPU to avoid multiprocessing issue
            logger.info("在 CPU 模式下強制使用單段語音處理，避免多處理器問題")
            
        # 模擬命令列參數對象
        class Args:
            def __init__(self):
                self.inputs = [str(file_path)]
                self.lang = request.lang
                self.whisper_mode = request.whisper_mode
                self.whisper_model = request.whisper_model
                self.prompt = request.prompt
                self.openai_rpm = request.openai_rpm
                self.device = request.device
                self.vad = vad_setting  # Use our modified VAD setting
                self.force = True
                self.encoding = "utf-8"
                # 添加缺少的屬性，避免 AttributeError
                self.transcribe = True
                self.cut = False
                self.daemon = False
                self.to_md = False
                self.s = False
                self.bitrate = "10m"
        
        args = Args()
        logger.info(f"轉錄參數: device={args.device}, model={args.whisper_model}, vad={args.vad}")
        
        # 建立 Transcribe 實例
        transcribe_instance = Transcribe(args)
        
        # 保存原始的進度回調
        original_progress = getattr(transcribe_instance, 'on_progress', None)

        # 定義新的進度回調
        def progress_callback(current, total):
            if original_progress:
                original_progress(current, total)
            progress = current / total if total > 0 else 0
            logger.info(f"轉錄進度: {progress:.2f}")
            update_task_status(task_id, "processing", progress)
        
        transcribe_instance.on_progress = progress_callback
        
        # 執行轉錄
        logger.info(f"開始轉錄檔案: {file_path}")
        result = transcribe_instance.run()
        logger.info(f"轉錄完成: {result}")
        
        # 轉錄完成後，檢查 SRT 檔案位置
        # 首先，檢查與原始檔案同目錄的 SRT 檔案
        srt_file = Path(str(file_path).replace(file_path.suffix, ".srt"))
        
        # 如果同目錄下找不到，嘗試在當前工作目錄尋找
        if not srt_file.exists():
            base_name = file_path.stem
            srt_file = Path(f"{base_name}.srt")
        
        # 如果找到 SRT 檔案，將其複製到結果目錄
        if srt_file.exists():
            logger.info(f"找到 SRT 檔案: {srt_file}")
            dest_path = output_dir / f"{task_id}.srt"
            shutil.copy(srt_file, dest_path)
            logger.info(f"已複製 SRT 檔案到: {dest_path}")
            update_task_status(
                task_id, 
                "completed", 
                1.0, 
                f"/api/results/{task_id}/{task_id}.srt"
            )
        else:
            logger.error(f"轉錄失敗: 找不到生成的 SRT 檔案")
            # 嘗試列出目錄內容，以便調試
            logger.info(f"原始檔案目錄內容: {list(file_path.parent.glob('*'))}")
            logger.info(f"當前工作目錄內容: {list(Path('.').glob('*'))}")
            raise Exception("轉錄失敗: 找不到生成的 SRT 檔案")
            
    except Exception as e:
        logger.error(f"轉錄錯誤: {str(e)}")
        update_task_status(task_id, "failed", error=str(e))

async def process_cut(task_id: str, video_file: Path, srt_file: Optional[Path], request: CutRequest):
    """處理影片剪切任務"""
    try:
        update_task_status(task_id, "processing", 0.1)

        # 確保任務輸出目錄存在
        output_dir = RESULTS_DIR / task_id
        output_dir.mkdir(exist_ok=True)
        
        # 延遲導入 Cutter 以避免導入問題
        from autocut.cut import Cutter
        
        # 模擬命令列參數對象
        class Args:
            def __init__(self):
                self.inputs = [str(video_file)]
                if srt_file:
                    self.inputs.append(str(srt_file))
                self.bitrate = request.bitrate
                self.force = True
                self.encoding = "utf-8"
                # 添加缺少的屬性，避免 AttributeError
                self.transcribe = False
                self.cut = True
                self.daemon = False
                self.to_md = False
                self.s = False
                self.lang = "zh"
                self.whisper_mode = "whisper"
                self.whisper_model = "small"
                self.prompt = ""
                self.openai_rpm = 3
                self.vad = "auto"
                self.device = None
        
        args = Args()
        
        # 創建 Cutter 實例
        cutter = Cutter(args)
        
        # 定義進度回調
        def progress_callback(current, total):
            progress = current / total if total > 0 else 0
            logger.info(f"剪切進度: {progress:.2f}")
            update_task_status(task_id, "processing", progress)
        
        cutter.on_progress = progress_callback
        
        # 執行剪切
        logger.info(f"開始剪切影片: {video_file}")
        result = cutter.run()
        logger.info(f"剪切完成: {result}")
        
        # 剪切完成後，尋找輸出檔案
        # 首先，檢查與原始檔案同目錄的輸出檔案
        output_file = Path(str(video_file).replace(video_file.suffix, '_cut' + video_file.suffix))
        
        # 如果同目錄下找不到，嘗試在當前工作目錄尋找
        if not output_file.exists():
            base_name = video_file.stem
            output_file = Path(f"{base_name}_cut{video_file.suffix}")
        
        # 如果找到輸出檔案，將其複製到結果目錄
        if output_file.exists():
            logger.info(f"找到輸出影片: {output_file}")
            dest_path = output_dir / f"{task_id}_cut{video_file.suffix}"
            shutil.copy(output_file, dest_path)
            logger.info(f"已複製輸出影片到: {dest_path}")
            update_task_status(
                task_id, 
                "completed", 
                1.0, 
                f"/api/results/{task_id}/{task_id}_cut{video_file.suffix}"
            )
        else:
            logger.error(f"剪切失敗: 找不到輸出影片")
            # 嘗試列出目錄內容，以便調試
            logger.info(f"原始檔案目錄內容: {list(video_file.parent.glob('*'))}")
            logger.info(f"當前工作目錄內容: {list(Path('.').glob('*'))}")
            raise Exception("剪切失敗: 找不到輸出影片")
            
    except Exception as e:
        logger.error(f"剪切錯誤: {str(e)}")
        update_task_status(task_id, "failed", error=str(e))

async def process_convert_srt(task_id: str, srt_file: Path, request: ConvertSrtRequest):
    """處理 SRT 轉換任務"""
    try:
        update_task_status(task_id, "processing", 0.1)
        # 確保輸出到結果目錄
        output_dir = RESULTS_DIR / task_id
        output_dir.mkdir(exist_ok=True)
        
        # 延遲導入工具函數
        from autocut.utils import trans_srt_to_md, compact_rst
        
        if request.format == "md":
            output_file = output_dir / f"{task_id}.md"
            logger.info(f"開始將 SRT 轉換為 MD: {srt_file} -> {output_file}")
            trans_srt_to_md(request.encoding, True, str(srt_file), str(output_file))
            result_url = f"/api/results/{task_id}/{task_id}.md"
        elif request.format == "compact":
            output_file = output_dir / f"{task_id}_compact.srt"
            logger.info(f"開始壓縮 SRT: {srt_file} -> {output_file}")
            compact_rst(str(srt_file), request.encoding, str(output_file))
            result_url = f"/api/results/{task_id}/{task_id}_compact.srt"
        else:
            raise ValueError(f"不支援的格式: {request.format}")
            
        logger.info(f"SRT 轉換完成: {output_file}")
        update_task_status(task_id, "completed", 1.0, result_url)
            
    except Exception as e:
        logger.error(f"SRT 轉換錯誤: {str(e)}")
        update_task_status(task_id, "failed", error=str(e))

# API 端點定義
@app.post("/api/upload", response_model=dict)
async def upload_file(file: UploadFile = File(...)):
    """上傳檔案"""
    file_id = str(uuid.uuid4())
    file_name = f"{file_id}_{file.filename}"
    file_path = UPLOAD_DIR / file_name
    
    try:
        # 保存上傳的檔案
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        logger.info(f"檔案上傳成功: {file_path}")
        return {
            "file_id": file_id,
            "file_name": file.filename,
            "stored_name": file_name,
            "content_type": file.content_type,
            "size": file_path.stat().st_size
        }
    except Exception as e:
        logger.error(f"檔案上傳錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe", response_model=TaskStatus)
async def transcribe_audio(
    background_tasks: BackgroundTasks,
    file_id: str = Form(...),
    lang: str = Form("zh"),
    whisper_mode: str = Form("whisper"),
    whisper_model: str = Form("small"),
    prompt: str = Form(""),
    openai_rpm: int = Form(3),
    device: Optional[str] = Form(None),
    vad: str = Form("auto")
):
    """轉錄音訊/影片為字幕"""
    try:
        logger.info(f"接收到轉錄請求: file_id={file_id}, lang={lang}, model={whisper_model}")
        file_path = get_file_path(file_id)
        logger.info(f"找到上傳的檔案: {file_path}")

        if device is None or device == "":
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"未指定設備，自動選擇: {device}")
        elif device not in ["cpu", "cuda"] and not device.startswith("cuda:"):
            logger.warning(f"不支援的設備: {device}，改用 CPU")
            device = "cpu"
        
        logger.info(f"使用設備: {device}")
        
        # 創建任務
        task_id = str(uuid.uuid4())
        update_task_status(task_id, "pending")
        
        # 創建請求對象
        request = TranscribeRequest(
            lang=lang,
            whisper_mode=whisper_mode,
            whisper_model=whisper_model,
            prompt=prompt,
            openai_rpm=openai_rpm,
            device=device,
            vad=vad
        )
        
        # 在後台處理任務
        logger.info(f"啟動後台轉錄任務: task_id={task_id}")
        background_tasks.add_task(process_transcribe, task_id, file_path, request)
        
        return TaskStatus(
            id=task_id,
            status="pending",
            progress=0.0
        )
    except Exception as e:
        logger.error(f"轉錄請求錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cut", response_model=TaskStatus)
async def cut_video(
    background_tasks: BackgroundTasks,
    file_id: str = Form(...),
    srt_file_id: Optional[str] = Form(None),
    bitrate: str = Form("10m")
):
    """根據字幕剪切影片"""
    try:
        logger.info(f"接收到剪切請求: file_id={file_id}, srt_file_id={srt_file_id}")
        video_path = get_file_path(file_id)
        logger.info(f"找到上傳的影片: {video_path}")
        
        # 查找 SRT 檔案
        srt_path = None
        if srt_file_id:
            srt_path = get_file_path(srt_file_id)
            logger.info(f"找到上傳的 SRT 檔案: {srt_path}")
        else:
            # 嘗試查找同名 SRT 檔案
            possible_srt = Path(str(video_path).replace(video_path.suffix, ".srt"))
            if possible_srt.exists():
                srt_path = possible_srt
                logger.info(f"找到同名 SRT 檔案: {srt_path}")
            else:
                # 嘗試在當前工作目錄查找
                base_name = video_path.stem
                possible_srt = Path(f"{base_name}.srt")
                if possible_srt.exists():
                    srt_path = possible_srt
                    logger.info(f"在當前工作目錄找到 SRT 檔案: {srt_path}")
        
        if not srt_path:
            logger.error("缺少 SRT 檔案，無法剪切影片")
            raise HTTPException(status_code=400, detail="需要 SRT 檔案才能進行剪切")
            
        # 創建任務
        task_id = str(uuid.uuid4())
        update_task_status(task_id, "pending")
        
        # 創建請求對象
        request = CutRequest(bitrate=bitrate)
        
        # 在後台處理任務
        logger.info(f"啟動後台剪切任務: task_id={task_id}")
        background_tasks.add_task(process_cut, task_id, video_path, srt_path, request)
        
        return TaskStatus(
            id=task_id,
            status="pending",
            progress=0.0
        )
    except Exception as e:
        logger.error(f"剪切請求錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/convert-srt", response_model=TaskStatus)
async def convert_srt(
    background_tasks: BackgroundTasks,
    file_id: str = Form(...),
    format: str = Form(...),  # "md" or "compact"
    encoding: str = Form("utf-8")
):
    """轉換 SRT 檔案格式"""
    try:
        logger.info(f"接收到 SRT 轉換請求: file_id={file_id}, format={format}")
        srt_path = get_file_path(file_id)
        logger.info(f"找到上傳的 SRT 檔案: {srt_path}")
        
        if srt_path.suffix.lower() != ".srt":
            logger.error(f"檔案不是 SRT 格式: {srt_path}")
            raise HTTPException(status_code=400, detail="檔案必須是 SRT 格式")
            
        # 創建任務
        task_id = str(uuid.uuid4())
        update_task_status(task_id, "pending")
        
        # 創建請求對象
        request = ConvertSrtRequest(format=format, encoding=encoding)
        
        # 在後台處理任務
        logger.info(f"啟動後台 SRT 轉換任務: task_id={task_id}")
        background_tasks.add_task(process_convert_srt, task_id, srt_path, request)
        
        return TaskStatus(
            id=task_id,
            status="pending",
            progress=0.0
        )
    except Exception as e:
        logger.error(f"SRT 轉換請求錯誤: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasks/{task_id}", response_model=TaskStatus)
async def get_task_status(task_id: str):
    """獲取任務狀態"""
    logger.info(f"查詢任務狀態: task_id={task_id}")
    if task_id not in tasks:
        logger.error(f"找不到任務: task_id={task_id}")
        raise HTTPException(status_code=404, detail=f"找不到任務 {task_id}")
        
    return TaskStatus(**tasks[task_id])

@app.get("/api/results/{task_id}/{file_name}")
async def get_result_file(task_id: str, file_name: str):
    """獲取任務結果檔案"""
    file_path = RESULTS_DIR / task_id / file_name
    logger.info(f"請求結果檔案: {file_path}")
    
    if not file_path.exists():
        logger.error(f"找不到結果檔案: {file_path}")
        raise HTTPException(status_code=404, detail=f"找不到結果檔案")
        
    return FileResponse(path=file_path)

# 主函數
def main():
    """啟動 API 伺服器"""
    logger.info("啟動 AutoCut API 伺服器")
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
