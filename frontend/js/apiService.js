/**
 * apiService.js - API communication for transcription services
 */

const ApiService = {
    /**
     * Upload a file to the API
     * @param {File} file - File to upload
     * @returns {Promise<string>} File ID
     */
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`${AppConfig.state.apiEndpoint}/api/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`API 錯誤: ${response.status}`);
            }
            
            const data = await response.json();
            return data.file_id;
        } catch (error) {
            console.error('上傳錯誤:', error);
            UIController.showError(`檔案上傳失敗: ${error.message}`);
            return null;
        }
    },
    
    /**
     * Request transcription from the API
     * @param {string} fileId - File ID
     * @returns {Promise<Object>} Task data
     */
    async transcribeVideo(fileId) {
        const formData = new FormData();
        formData.append('file_id', fileId);
        formData.append('lang', AppConfig.state.language);
        formData.append('whisper_mode', 'whisper');
        formData.append('whisper_model', AppConfig.state.whisperModel);
        formData.append('device', AppConfig.state.device);
        
        try {
            const response = await fetch(`${AppConfig.state.apiEndpoint}/api/transcribe`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`API 錯誤: ${response.status}`);
            }
            
            const data = await response.json();
            AppConfig.state.apiTaskId = data.id;
            return data;
        } catch (error) {
            console.error('轉錄錯誤:', error);
            UIController.showError(`開始轉錄失敗: ${error.message}`);
            return null;
        }
    },
    
    /**
     * Check the status of a transcription task
     * @param {string} taskId - Task ID
     * @returns {Promise<Object>} Task status
     */
    async checkTaskStatus(taskId) {
        try {
            const response = await fetch(`${AppConfig.state.apiEndpoint}/api/tasks/${taskId}`);
            
            if (!response.ok) {
                throw new Error(`API 錯誤: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('狀態檢查錯誤:', error);
            UIController.showError(`檢查任務狀態失敗: ${error.message}`);
            return null;
        }
    },
    
    /**
     * Start polling for task status
     * @param {string} taskId - Task ID
     * @param {Function} onComplete - Callback for completion
     */
    startStatusPolling(taskId, onComplete) {
        const elements = UIController.elements;
        
        // Clear existing interval
        if (AppConfig.state.apiStatusInterval) {
            clearInterval(AppConfig.state.apiStatusInterval);
        }
        
        // Start new polling interval
        AppConfig.state.apiStatusInterval = setInterval(async () => {
            const status = await this.checkTaskStatus(taskId);
            if (!status) return;
            
            // Update progress display
            const progressBar = elements.apiProgressBar;
            const progressText = elements.apiProgressText;
            const progressPercentage = Math.round(status.progress * 100);
            
            if (progressBar) progressBar.style.width = `${progressPercentage}%`;
            if (progressText) progressText.textContent = `${progressPercentage}%`;
            
            // Handle completion or failure
            if (status.status === 'completed') {
                clearInterval(AppConfig.state.apiStatusInterval);
                elements.apiMessage.textContent = '任務成功完成！';
                elements.apiSpinner?.classList.remove('animate-spin');
                
                // Hide API status after delay
                setTimeout(() => {
                    elements.apiStatus?.classList.remove('active');
                }, 3000);
                
                if (onComplete) {
                    onComplete(status);
                }
            } else if (status.status === 'failed') {
                clearInterval(AppConfig.state.apiStatusInterval);
                elements.apiMessage.textContent = `任務失敗: ${status.error || '未知錯誤'}`;
                elements.apiSpinner?.classList.remove('animate-spin');
                
                // Hide API status after longer delay
                setTimeout(() => {
                    elements.apiStatus?.classList.remove('active');
                }, 5000);
                
                UIController.showError(`任務失敗: ${status.error || '未知錯誤'}`);
                
                if (onComplete) {
                    onComplete(status);
                }
            }
        }, 2000);
    },
    
    /**
     * Download the result of a completed task
     * @param {string} resultUrl - URL to download from
     * @returns {Promise<string>} File content
     */
    async downloadResult(resultUrl) {
        try {
            const url = `${AppConfig.state.apiEndpoint}${resultUrl}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`下載失敗: ${response.status}`);
            }
            
            return await response.text();
        } catch (error) {
            console.error('下載錯誤:', error);
            UIController.showError(`下載結果失敗: ${error.message}`);
            return null;
        }
    }
};
