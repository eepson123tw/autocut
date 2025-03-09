/**
 * SubtitleApp - A modern approach to video subtitle management
 */
class SubtitleApp {
  constructor() {
    // Configuration and state
    this.state = {
      apiEndpoint: localStorage.getItem('apiEndpoint') || 'http://localhost:8000',
      language: localStorage.getItem('language') || 'zh',
      whisperModel: localStorage.getItem('whisperModel') || 'small',
      device: localStorage.getItem('device') || 'cuda',
      subtitles: [],
      currentSubtitleIndex: -1,
      videoFile: null,
      srtFile: null,
      apiTaskId: null,
      apiStatusInterval: null
    };

    // Element references - store DOM references to avoid repeated querySelector calls
    this.elements = {};
    
    // Initialize the application when DOM is ready
    document.addEventListener('DOMContentLoaded', () => this.initialize());
  }

  /**
   * Initialize the application
   */
  initialize() {
    this.cacheElements();
    this.loadSettings();
    this.setupNetworkMonitoring();
    this.setupPageProtection();
    this.setupEventListeners();
    this.setupFormProtection();
    this.setupTextareaAutoResize();
    this.setupFileUploadAreas();
  }

  /**
   * Cache DOM elements for better performance
   */
  cacheElements() {
    // Store references to frequently accessed DOM elements
    const elements = [
      'video-player', 'api-endpoint', 'language-select', 'model-select', 
      'device-select', 'video-upload-area', 'video-upload', 'srt-upload-area', 
      'srt-upload', 'video-filename', 'srt-filename', 'player-section',
      'transcribe-btn', 'transcribe-hint', 'subtitle-editor', 'workflow-guide',
      'subtitle-list', 'current-subtitle', 'export-srt', 'export-srt-alt',
      'settings-btn', 'settings-modal', 'close-settings', 'save-settings',
      'help-btn', 'help-modal', 'close-help', 'close-help-btn',
      'prev-subtitle', 'next-subtitle', 'replay-subtitle', 'subtitle-search',
      'api-status', 'api-progress-container', 'api-message', 'api-progress-bar',
      'api-progress-text', 'api-spinner', 'error-message', 'no-video-warning'
    ];

    // Create an object with element references
    this.elements = elements.reduce((acc, id) => {
      acc[this.camelCase(id)] = document.getElementById(id);
      return acc;
    }, {});
  }

  /**
   * Convert kebab-case to camelCase for element references
   */
  camelCase(str) {
    return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  }

  /**
   * Load settings into the UI
   */
  loadSettings() {
    if (!this.elements.apiEndpoint) return;
    
    this.elements.apiEndpoint.value = this.state.apiEndpoint;
    this.elements.languageSelect.value = this.state.language;
    this.elements.modelSelect.value = this.state.whisperModel;
    this.elements.deviceSelect.value = this.state.device;
  }

  /**
   * Setup monitoring for network requests
   */
  setupNetworkMonitoring() {
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      console.log('發起請求:', args[0], args[1]?.method || 'GET');
      return originalFetch.apply(window, args)
        .then(response => {
          console.log('請求回應:', args[0], response.status);
          return response;
        })
        .catch(error => {
          console.error('請求錯誤:', args[0], error);
          throw error;
        });
    };
  }

  /**
   * Setup page unload protection to prevent accidental navigation
   */
  setupPageProtection() {
    let unloadCount = 0;
    window.addEventListener('beforeunload', (e) => {
      unloadCount++;
      console.error(
        `第${unloadCount}次頁面卸載嘗試, 頁面活動元素:`, 
        document.activeElement.tagName, 
        document.activeElement.id
      );
      
      console.trace('頁面卸載調用堆疊');
      
      e.preventDefault();
      e.returnValue = '';
      return '';
    });
  }

  /**
   * Prevent form submissions
   */
  setupFormProtection() {
    document.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('已阻止表單提交');
      return false;
    }, true);
  }

  /**
   * Setup event listeners for the application
   */
  setupEventListeners() {
    // Video player events
    this.elements.videoPlayer?.addEventListener('timeupdate', () => this.updateCurrentSubtitle());
    
    // Export buttons
    this.elements.exportSrt?.addEventListener('click', () => this.exportSrt());
    this.elements.exportSrtAlt?.addEventListener('click', () => this.exportSrt());
    
    // Settings modal
    this.elements.settingsBtn?.addEventListener('click', () => this.openModal('settings'));
    this.elements.closeSettings?.addEventListener('click', () => this.closeModal('settings'));
    this.elements.saveSettings?.addEventListener('click', () => this.saveSettings());
    
    // Help modal
    this.elements.helpBtn?.addEventListener('click', () => this.openModal('help'));
    this.elements.closeHelp?.addEventListener('click', () => this.closeModal('help'));
    this.elements.closeHelpBtn?.addEventListener('click', () => this.closeModal('help'));
    
    // Transcribe button
    this.elements.transcribeBtn?.addEventListener('click', () => this.handleTranscribeBtn());
    
    // Subtitle navigation
    this.elements.prevSubtitle?.addEventListener('click', () => this.navigateSubtitle('prev'));
    this.elements.nextSubtitle?.addEventListener('click', () => this.navigateSubtitle('next'));
    this.elements.replaySubtitle?.addEventListener('click', () => this.navigateSubtitle('replay'));
    
    // Subtitle search
    this.elements.subtitleSearch?.addEventListener('input', (e) => this.searchSubtitles(e.target.value));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    
    // Modal backdrop click to close
    window.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) {
        this.closeModal('settings');
      }
      if (e.target === this.elements.helpModal) {
        this.closeModal('help');
      }
    });
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {
    // Skip if focus is in an input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    switch (e.key) {
      case ' ': // Space - play/pause
        if (this.elements.videoPlayer.paused) {
          this.elements.videoPlayer.play();
        } else {
          this.elements.videoPlayer.pause();
        }
        e.preventDefault();
        break;
      case 'ArrowLeft': // Previous subtitle
        this.navigateSubtitle('prev');
        e.preventDefault();
        break;
      case 'ArrowRight': // Next subtitle
        this.navigateSubtitle('next');
        e.preventDefault();
        break;
      case 'r': // Replay current subtitle
      case 'R':
        this.navigateSubtitle('replay');
        e.preventDefault();
        break;
    }
  }

  /**
   * Navigate subtitles (prev, next, replay)
   */
  navigateSubtitle(direction) {
    switch (direction) {
      case 'prev':
        if (this.state.currentSubtitleIndex > 0) {
          this.jumpToSubtitle(this.state.currentSubtitleIndex - 1);
        }
        break;
      case 'next':
        if (this.state.currentSubtitleIndex < this.state.subtitles.length - 1) {
          this.jumpToSubtitle(this.state.currentSubtitleIndex + 1);
        }
        break;
      case 'replay':
        if (this.state.currentSubtitleIndex >= 0) {
          this.jumpToSubtitle(this.state.currentSubtitleIndex);
        }
        break;
    }
  }

  /**
   * Open a modal by name
   */
  openModal(modalName) {
    const modal = this.elements[`${modalName}Modal`];
    if (!modal) return;
    
    modal.classList.remove('hidden');
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
  }

  /**
   * Close a modal by name
   */
  closeModal(modalName) {
    const modal = this.elements[`${modalName}Modal`];
    if (!modal) return;
    
    modal.classList.remove('active');
    setTimeout(() => {
      modal.classList.add('hidden');
    }, 500);
  }

  /**
   * Save settings from the modal
   */
  saveSettings() {
    // Update state with form values
    this.state.apiEndpoint = this.elements.apiEndpoint.value;
    this.state.language = this.elements.languageSelect.value;
    this.state.whisperModel = this.elements.modelSelect.value;
    this.state.device = this.elements.deviceSelect.value;
    
    // Save to localStorage
    localStorage.setItem('apiEndpoint', this.state.apiEndpoint);
    localStorage.setItem('language', this.state.language);
    localStorage.setItem('whisperModel', this.state.whisperModel);
    localStorage.setItem('device', this.state.device);
    
    // Close the modal
    this.closeModal('settings');
    this.showMessage('設定已儲存', 'success');
  }

  /**
   * Setup auto-resize for textareas
   */
  setupTextareaAutoResize() {
    document.addEventListener('input', (e) => {
      if (e.target.tagName.toLowerCase() === 'textarea') {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
      }
    });
  }

  /**
   * Setup file upload areas
   */
  setupFileUploadAreas() {
    // Setup video upload area
    this.setupFileUpload(
      this.elements.videoUploadArea, 
      this.elements.videoUpload, 
      (files) => this.handleVideoFileSelect(files)
    );
    
    // Setup SRT upload area
    this.setupFileUpload(
      this.elements.srtUploadArea, 
      this.elements.srtUpload, 
      (files) => this.handleSrtFileSelect(files)
    );
  }

  /**
   * Setup a file upload area with click and change handlers
   */
  setupFileUpload(area, input, handler) {
    if (!area || !input) return;
    
    // Click on area triggers file input
    area.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const clickEvent = new MouseEvent('click', {
        bubbles: false,
        cancelable: true,
        view: window
      });
      input.dispatchEvent(clickEvent);
      
      return false;
    });
    
    // Handle file selection
    input.addEventListener('change', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      handler(input.files);
      return false;
    }, false);
  }

  /**
   * Handle video file selection
   */
  handleVideoFileSelect(files) {
    const file = files?.[0];
    if (!file) return;
    
    this.state.videoFile = file;
    this.elements.videoFilename.textContent = file.name;
    this.elements.videoFilename.classList.remove('hidden');
    
    // Create and set object URL for video
    const url = URL.createObjectURL(file);
    this.elements.videoPlayer.src = url;
    
    // Activate player section
    this.elements.playerSection.classList.add('active');
    
    // Enable transcribe button
    this.elements.transcribeBtn.disabled = false;
    this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    this.elements.transcribeHint?.classList.add('hidden');
    
    this.showMessage(`影片已載入: ${file.name}`, 'success');
  }

  /**
   * Handle SRT file selection
   */
  handleSrtFileSelect(files) {
    const file = files?.[0];
    if (!file) return;
    
    this.state.srtFile = file;
    this.elements.srtFilename.textContent = '正在讀取...';
    this.elements.srtFilename.classList.remove('hidden');
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        // Parse SRT content
        this.state.subtitles = this.parseSrt(e.target.result);
        
        // Update filename display
        this.elements.srtFilename.textContent = file.name;
        
        // Render subtitle list
        this.renderSubtitleList();
        
        // Show subtitle editor
        setTimeout(() => {
          this.elements.subtitleEditor.classList.add('active');
          
          if (this.state.videoFile) {
            if (!this.elements.playerSection.classList.contains('active')) {
              this.elements.playerSection.classList.add('active');
            }
          }
          
          // Hide workflow guide
          this.elements.workflowGuide.style.opacity = 0;
          setTimeout(() => {
            this.elements.workflowGuide.classList.add('hidden');
          }, 300);
        }, 300);
        
        this.elements.errorMessage?.classList.add('hidden');
        this.showMessage(`SRT 已載入: ${file.name}`, 'success');
      } catch (error) {
        this.elements.srtFilename.textContent = file.name;
        this.showError(`SRT 檔案解析失敗: ${error.message}`);
      }
    };
    
    reader.onerror = () => {
      this.elements.srtFilename.textContent = file.name;
      this.showError('讀取檔案時發生錯誤');
    };
    
    reader.readAsText(file);
  }

  /**
   * Format seconds to SRT time format (HH:MM:SS,mmm)
   */
  formatSrtTime(seconds) {
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const secs = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${secs},${ms}`;
  }
  
  /**
   * Convert SRT time format to seconds
   */
  srtTimeToSeconds(srtTime) {
    const parts = srtTime.split(':');
    const seconds = parts[2].split(',');
    return parseInt(parts[0]) * 3600 + 
           parseInt(parts[1]) * 60 + 
           parseInt(seconds[0]) + 
           parseInt(seconds[1]) / 1000;
  }
  
  /**
   * Parse SRT content into subtitle objects
   */
  parseSrt(content) {
    const lines = content.split(/\r?\n/);
    const result = [];
    let index = 0;
    
    while (index < lines.length) {
      // Skip empty lines
      if (lines[index].trim() === '') {
        index++;
        continue;
      }
      
      // Parse subtitle number
      const number = parseInt(lines[index].trim());
      index++;
      
      if (index >= lines.length) break;
      
      // Parse time line
      const timeLine = lines[index].trim();
      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      
      if (!timeMatch) {
        index++;
        continue;
      }
      
      const startTime = timeMatch[1];
      const endTime = timeMatch[2];
      index++;
      
      // Parse subtitle text
      let text = '';
      while (index < lines.length && lines[index].trim() !== '' && !lines[index].match(/^\d+$/)) {
        text += (text ? '\n' : '') + lines[index];
        index++;
      }
      
      result.push({
        number,
        startTime,
        endTime,
        text,
        startSeconds: this.srtTimeToSeconds(startTime),
        endSeconds: this.srtTimeToSeconds(endTime)
      });
    }
    
    return result;
  }
  
  /**
   * Render the subtitle list
   */
  renderSubtitleList() {
    const subtitleListElement = this.elements.subtitleList;
    if (!subtitleListElement) return;
    
    subtitleListElement.innerHTML = '';
    
    // Show/hide no video warning
    const noVideoWarning = this.elements.noVideoWarning;
    if (noVideoWarning) {
      if (!this.state.videoFile && this.state.subtitles.length > 0) {
        noVideoWarning.classList.remove('hidden');
      } else {
        noVideoWarning.classList.add('hidden');
      }
    }
    
    // Create subtitle items
    this.state.subtitles.forEach((subtitle, index) => {
      const subtitleItem = document.createElement('div');
      subtitleItem.className = 'grid grid-cols-12 gap-2 p-3 border-b border-gray-200 hover:bg-gray-50 transition-colors subtitle-row';
      
      if (index === this.state.currentSubtitleIndex) {
        subtitleItem.classList.add('subtitle-active');
      }
      
      // Time display class based on video availability
      const timeClassNames = this.state.videoFile 
        ? "col-span-3 text-blue-600 hover:text-blue-800 cursor-pointer subtitle-time time-display" 
        : "col-span-3 text-gray-600 time-display";
      
      subtitleItem.innerHTML = `
        <div class="col-span-1 text-gray-500 text-center">${subtitle.number}</div>
        <div class="${timeClassNames}" data-index="${index}">
            ${subtitle.startTime} → ${subtitle.endTime}
        </div>
        <div class="col-span-6">
            <textarea data-index="${index}" class="w-full px-2 py-1 border border-gray-300 rounded resize-none focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 auto-resize-textarea subtitle-text">${subtitle.text}</textarea>
        </div>
        <div class="col-span-2 text-right space-x-1">
            <button class="edit-time-btn bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded text-sm transition-colors hover-scale" data-index="${index}" title="編輯時間">
                <i class="fas fa-clock"></i>
            </button>
            ${this.state.videoFile ? `
            <button class="play-btn bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2 py-1 rounded text-sm transition-colors hover-scale" data-index="${index}" title="播放此字幕">
                <i class="fas fa-play"></i>
            </button>
            ` : ''}
        </div>
      `;
      
      subtitleListElement.appendChild(subtitleItem);
      
      // Auto-resize textarea
      const textarea = subtitleItem.querySelector('textarea');
      textarea.style.height = 'auto';
      textarea.style.height = (textarea.scrollHeight) + 'px';
    });
    
    // Add event listeners to subtitle items
    this.attachSubtitleItemEvents();
  }
  
  /**
   * Attach event listeners to subtitle list items
   */
  attachSubtitleItemEvents() {
    // Time click event (jump to subtitle)
    if (this.state.videoFile) {
      document.querySelectorAll('.subtitle-time').forEach(element => {
        element.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.getAttribute('data-index'));
          this.jumpToSubtitle(index);
        });
      });
      
      document.querySelectorAll('.play-btn').forEach(element => {
        element.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.getAttribute('data-index'));
          this.jumpToSubtitle(index);
        });
      });
    }
    
    // Textarea change event (update subtitle text)
    document.querySelectorAll('textarea[data-index]').forEach(element => {
      element.addEventListener('change', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        this.state.subtitles[index].text = e.currentTarget.value;
      });
      
      // Auto-resize on input
      element.addEventListener('input', (e) => {
        e.currentTarget.style.height = 'auto';
        e.currentTarget.style.height = (e.currentTarget.scrollHeight) + 'px';
      });
    });
    
    // Edit time button event
    document.querySelectorAll('.edit-time-btn').forEach(element => {
      element.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        this.editSubtitleTime(index);
      });
    });
  }
  
  /**
   * Jump to a specific subtitle
   */
  jumpToSubtitle(index) {
    if (index >= 0 && index < this.state.subtitles.length && this.elements.videoPlayer) {
      this.elements.videoPlayer.currentTime = this.state.subtitles[index].startSeconds;
      this.elements.videoPlayer.play().catch(err => console.error('Video playback error:', err));
      this.updateCurrentSubtitle(index, true);
    }
  }
  
  /**
   * Edit a subtitle's time
   */
  editSubtitleTime(index) {
    const subtitle = this.state.subtitles[index];
    if (!subtitle) return;
    
    const newTimeStr = prompt(
      '輸入新的時間範圍 (格式: HH:MM:SS,mmm --> HH:MM:SS,mmm)',
      `${subtitle.startTime} --> ${subtitle.endTime}`
    );
    
    if (newTimeStr) {
      const timeMatch = newTimeStr.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (timeMatch) {
        subtitle.startTime = timeMatch[1];
        subtitle.endTime = timeMatch[2];
        subtitle.startSeconds = this.srtTimeToSeconds(subtitle.startTime);
        subtitle.endSeconds = this.srtTimeToSeconds(subtitle.endTime);
        this.renderSubtitleList();
      } else {
        this.showError('時間格式無效。請使用 HH:MM:SS,mmm --> HH:MM:SS,mmm 格式');
      }
    }
  }
  
  /**
   * Update current subtitle display based on video time
   */
  updateCurrentSubtitle(forceIndex = null, scrollToView = false) {
    if (!this.elements.videoPlayer || !this.elements.currentSubtitle) return;
    
    const currentTime = this.elements.videoPlayer.currentTime;
    let foundIndex = -1;
    
    // Use forced index or find subtitle based on current time
    if (forceIndex !== null && forceIndex >= 0 && forceIndex < this.state.subtitles.length) {
      foundIndex = forceIndex;
    } else {
      // Find subtitle that matches current time
      for (let i = 0; i < this.state.subtitles.length; i++) {
        if (currentTime >= this.state.subtitles[i].startSeconds && 
            currentTime <= this.state.subtitles[i].endSeconds) {
          foundIndex = i;
          break;
        }
      }
    }
    
    // Update only if the current subtitle has changed
    if (foundIndex !== this.state.currentSubtitleIndex) {
      this.state.currentSubtitleIndex = foundIndex;
      
      if (foundIndex >= 0) {
        this.elements.currentSubtitle.innerHTML = `<span>${this.state.subtitles[foundIndex].text}</span>`;
        this.elements.currentSubtitle.classList.add('subtitle-highlight');
        
        // Update active subtitle in list
        document.querySelectorAll('#subtitle-list > div').forEach((item, index) => {
          if (index === foundIndex) {
            item.classList.add('subtitle-active');
            
            // Scroll into view if requested
            if (scrollToView) {
              item.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            item.classList.remove('subtitle-active');
          }
        });
      } else {
        this.elements.currentSubtitle.innerHTML = `<span class="text-gray-400">沒有正在播放的字幕</span>`;
      }
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        this.elements.currentSubtitle.classList.remove('subtitle-highlight');
      }, 2000);
    }
  }
  
  /**
   * Search subtitles by text
   */
  searchSubtitles(searchTerm) {
    searchTerm = searchTerm.toLowerCase().trim();
    
    if (searchTerm === '') {
      this.renderSubtitleList();
      return;
    }
    
    document.querySelectorAll('#subtitle-list > div').forEach((item, index) => {
      const subtitle = this.state.subtitles[index];
      if (subtitle) {
        const text = subtitle.text.toLowerCase();
        
        if (text.includes(searchTerm)) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      }
    });
  }
  
  /**
   * Export subtitles as SRT file
   */
  exportSrt() {
    if (this.state.subtitles.length === 0) {
      this.showError('沒有可匯出的字幕');
      return;
    }
    
    let content = '';
    
    this.state.subtitles.forEach(subtitle => {
      content += `${subtitle.number}\n`;
      content += `${subtitle.startTime} --> ${subtitle.endTime}\n`;
      content += `${subtitle.text}\n\n`;
    });
    
    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'edited.srt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showMessage('SRT 檔案匯出成功', 'success');
  }
  
  /**
   * Upload a file to the API
   */
  async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch(`${this.state.apiEndpoint}/api/upload`, {
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
      this.showError(`檔案上傳失敗: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Request transcription from the API
   */
  async transcribeVideo(fileId) {
    const formData = new FormData();
    formData.append('file_id', fileId);
    formData.append('lang', this.state.language);
    formData.append('whisper_mode', 'whisper');
    formData.append('whisper_model', this.state.whisperModel);
    formData.append('device', this.state.device);
    
    try {
      const response = await fetch(`${this.state.apiEndpoint}/api/transcribe`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`API 錯誤: ${response.status}`);
      }
      
      const data = await response.json();
      this.state.apiTaskId = data.id;
      return data;
    } catch (error) {
      console.error('轉錄錯誤:', error);
      this.showError(`開始轉錄失敗: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Check the status of a transcription task
   */
  async checkTaskStatus(taskId) {
    try {
      const response = await fetch(`${this.state.apiEndpoint}/api/tasks/${taskId}`);
      
      if (!response.ok) {
        throw new Error(`API 錯誤: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('狀態檢查錯誤:', error);
      this.showError(`檢查任務狀態失敗: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Start the transcription process
   */
  async handleTranscribeBtn() {
    if (!this.state.videoFile) {
      this.showError('請先上傳影片檔案');
      return;
    }
    
    // Show API status
    const apiStatus = this.elements.apiStatus;
    if (apiStatus) {
      apiStatus.classList.add('active');
    }
    
    this.elements.apiProgressContainer?.classList.remove('hidden');
    this.elements.apiMessage.textContent = '正在上傳影片...';
    
    // Disable transcribe button
    this.elements.transcribeBtn.disabled = true;
    this.elements.transcribeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    
    // Upload video file
    const fileId = await this.uploadFile(this.state.videoFile);
    if (!fileId) {
      apiStatus?.classList.remove('active');
      this.elements.transcribeBtn.disabled = false;
      this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      return;
    }
    
    // Start transcription
    this.elements.apiMessage.textContent = '正在開始轉錄...';
    const taskData = await this.transcribeVideo(fileId);
    if (!taskData) {
      apiStatus?.classList.remove('active');
      this.elements.transcribeBtn.disabled = false;
      this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      return;
    }
    
    // Poll for status updates
    this.elements.apiMessage.textContent = '正在轉錄影片...';
    this.startStatusPolling(taskData.id, async (status) => {
      if (status.status === 'completed') {
        const srtUrl = `${this.state.apiEndpoint}${status.result_url}`;
        try {
          const response = await fetch(srtUrl);
          if (!response.ok) {
            throw new Error(`下載 SRT 失敗: ${response.status}`);
          }
          
          const srtContent = await response.text();
          
          // Create SRT file
          const srtBlob = new Blob([srtContent], { type: 'text/plain' });
          this.state.srtFile = new File([srtBlob], 'transcribed.srt', { type: 'text/plain' });
          this.elements.srtFilename.textContent = 'transcribed.srt';
          this.elements.srtFilename.classList.remove('hidden');
          
          // Parse subtitles
          this.state.subtitles = this.parseSrt(srtContent);
          
          // Re-enable transcribe button
          this.elements.transcribeBtn.disabled = false;
          this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
          
          // Render subtitle list
          this.renderSubtitleList();
          
          // Show subtitle editor
          if (!this.elements.subtitleEditor.classList.contains('active')) {
            this.elements.subtitleEditor.classList.add('active');
            
            // Hide workflow guide if visible
            if (!this.elements.workflowGuide.classList.contains('hidden')) {
              this.elements.workflowGuide.style.opacity = 0;
              setTimeout(() => {
                this.elements.workflowGuide.classList.add('hidden');
              }, 300);
            }
          }
          
          this.showMessage('轉錄完成！', 'success');
        } catch (error) {
          console.error('SRT 下載錯誤:', error);
          this.showError(`下載 SRT 檔案失敗: ${error.message}`);
          this.elements.transcribeBtn.disabled = false;
          this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      } else if (status.status === 'failed') {
        this.elements.transcribeBtn.disabled = false;
        this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }
  
  /**
   * Start polling for task status
   */
  startStatusPolling(taskId, onComplete) {
    // Clear existing interval
    if (this.state.apiStatusInterval) {
      clearInterval(this.state.apiStatusInterval);
    }
    
    // Start new polling interval
    this.state.apiStatusInterval = setInterval(async () => {
      const status = await this.checkTaskStatus(taskId);
      if (!status) return;
      
      // Update progress display
      const progressBar = this.elements.apiProgressBar;
      const progressText = this.elements.apiProgressText;
      const progressPercentage = Math.round(status.progress * 100);
      
      if (progressBar) progressBar.style.width = `${progressPercentage}%`;
      if (progressText) progressText.textContent = `${progressPercentage}%`;
      
      // Handle completion or failure
      if (status.status === 'completed') {
        clearInterval(this.state.apiStatusInterval);
        this.elements.apiMessage.textContent = '任務成功完成！';
        this.elements.apiSpinner?.classList.remove('animate-spin');
        
        // Hide API status after delay
        setTimeout(() => {
          this.elements.apiStatus?.classList.remove('active');
        }, 3000); 
        
        if (onComplete) {
          onComplete(status);
        }
      } else if (status.status === 'failed') {
        clearInterval(this.state.apiStatusInterval);
        this.elements.apiMessage.textContent = `任務失敗: ${status.error || '未知錯誤'}`;
        this.elements.apiSpinner?.classList.remove('animate-spin');
        
        // Hide API status after longer delay
        setTimeout(() => {
          this.elements.apiStatus?.classList.remove('active');
        }, 5000);
        
        this.showError(`任務失敗: ${status.error || '未知錯誤'}`);
        
        if (onComplete) {
          onComplete(status);
        }
      }
    }, 2000); 
  }
  
  /**
   * Show an error message
   */
  showError(message) {
    const errorElement = this.elements.errorMessage;
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
      
      // Hide after 5 seconds
      setTimeout(() => {
        errorElement.classList.add('hidden');
      }, 5000);
    }
    
    // Also show as toast
    this.showToast(message, 'error');
  }
  
  /**
   * Show a message
   */
  showMessage(message, type = 'info') {
    this.showToast(message, type);
  }
  
  /**
   * Show a toast notification
   */
  showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    });
    
    // Create toast element
    const toastElement = document.createElement('div');
    toastElement.className = `toast-notification p-4 rounded-lg shadow-lg ${
      type === 'success' ? 'bg-green-100 text-green-800 border-l-4 border-green-500' : 
      type === 'error' ? 'bg-red-100 text-red-800 border-l-4 border-red-500' : 
      'bg-blue-100 text-blue-800 border-l-4 border-blue-500'
    }`;
    
    // Set icon based on type
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' : 
                 'information-circle';
    
    toastElement.innerHTML = `
      <div class="flex items-center">
        <i class="fas fa-${icon} mr-2"></i>
        <span>${message}</span>
        <button class="ml-auto text-gray-500 hover:text-gray-700 focus:outline-none">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    // Add close button event
    toastElement.querySelector('button').addEventListener('click', () => {
      if (document.body.contains(toastElement)) {
        document.body.removeChild(toastElement);
      }
    });
    
    document.body.appendChild(toastElement);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (document.body.contains(toastElement)) {
        toastElement.style.opacity = '0';
        setTimeout(() => {
          if (document.body.contains(toastElement)) {
            document.body.removeChild(toastElement);
          }
        }, 300);
      }
    }, 5000);
  }
}

// Initialize the application
const subtitleApp = new SubtitleApp();
