/**
 * uiController.js - UI interactions and DOM manipulation
 */

const UIController = {
    // Element references - will be populated in init()
    elements: {},
    
    /**
     * Initialize the UI controller
     * Cache DOM elements and setup event listeners
     */
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.setupFormProtection();
        this.setupTextareaAutoResize();
        this.setupFileUploadAreas();
        this.loadSettings();
        
        return this;
    },
    
    /**
     * Cache DOM elements for better performance
     */
    cacheElements() {
        // Store references to frequently accessed DOM elements
        const elementIds = [
            'video-player', 'api-endpoint', 'language-select', 'model-select', 
            'device-select', 'video-upload-area', 'video-upload', 'srt-upload-area', 
            'srt-upload', 'video-filename', 'srt-filename', 'player-section',
            'transcribe-btn', 'transcribe-hint', 'subtitle-editor', 'workflow-guide',
            'subtitle-list', 'current-subtitle', 'export-srt', 'export-srt-alt',
            'settings-btn', 'settings-modal', 'close-settings', 'save-settings',
            'help-btn', 'help-modal', 'close-help', 'close-help-btn',
            'prev-subtitle', 'next-subtitle', 'replay-subtitle', 'subtitle-search',
            'api-status', 'api-progress-container', 'api-message', 'api-progress-bar',
            'api-progress-text', 'api-spinner', 'error-message', 'no-video-warning',
            'timeline', 'timeline-container', 'timeline-content', 'timeline-cursor',
            'timeline-zoom-in', 'timeline-zoom-out', 'timeline-current-time',
            'timeline-section'
        ];

        // Create an object with element references
        this.elements = elementIds.reduce((acc, id) => {
            acc[this.camelCase(id)] = document.getElementById(id);
            return acc;
        }, {});
    },

    /**
     * Convert kebab-case to camelCase for element references
     */
    camelCase(str) {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    },
    
    /**
     * Load settings into the UI
     */
    loadSettings() {
        if (!this.elements.apiEndpoint) return;
        
        this.elements.apiEndpoint.value = AppConfig.state.apiEndpoint;
        this.elements.languageSelect.value = AppConfig.state.language;
        this.elements.modelSelect.value = AppConfig.state.whisperModel;
        this.elements.deviceSelect.value = AppConfig.state.device;
    },
    
    /**
     * Setup event listeners for the application
     */
    setupEventListeners() {
        // Video player events
        this.elements.videoPlayer?.addEventListener('timeupdate', () => SubtitleEditor.updateCurrentSubtitle());
        
        // Export buttons
        this.elements.exportSrt?.addEventListener('click', () => SubtitleParser.exportSrt(AppConfig.state.subtitles));
        this.elements.exportSrtAlt?.addEventListener('click', () => SubtitleParser.exportSrt(AppConfig.state.subtitles));
        
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
        this.elements.prevSubtitle?.addEventListener('click', () => SubtitleEditor.navigateSubtitle('prev'));
        this.elements.nextSubtitle?.addEventListener('click', () => SubtitleEditor.navigateSubtitle('next'));
        this.elements.replaySubtitle?.addEventListener('click', () => SubtitleEditor.navigateSubtitle('replay'));
        
        // Subtitle search
        this.elements.subtitleSearch?.addEventListener('input', (e) => SubtitleEditor.searchSubtitles(e.target.value));
        
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
    },
    
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
                if (this.elements.videoPlayer?.paused) {
                    this.elements.videoPlayer.play();
                } else if (this.elements.videoPlayer) {
                    this.elements.videoPlayer.pause();
                }
                e.preventDefault();
                break;
            case 'ArrowLeft': // Previous subtitle
                SubtitleEditor.navigateSubtitle('prev');
                e.preventDefault();
                break;
            case 'ArrowRight': // Next subtitle
                SubtitleEditor.navigateSubtitle('next');
                e.preventDefault();
                break;
            case 'r': // Replay current subtitle
            case 'R':
                SubtitleEditor.navigateSubtitle('replay');
                e.preventDefault();
                break;
        }
    },
    
    /**
     * Setup page unload protection to prevent accidental navigation
     */
    setupPageProtection() {
        window.addEventListener('beforeunload', (e) => {
            if (AppConfig.state.subtitles.length > 0) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        });
    },
    
    /**
     * Prevent form submissions
     */
    setupFormProtection() {
        document.addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('已阻止表單提交');
            return false;
        }, true);
    },
    
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
    },
    
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
    },
    
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
    },
    
    /**
     * Handle video file selection
     */
    handleVideoFileSelect(files) {
        const file = files?.[0];
        if (!file) return;
        
        AppConfig.state.videoFile = file;
        this.elements.videoFilename.textContent = file.name;
        this.elements.videoFilename.classList.remove('hidden');
        
        // Create and set object URL for video
        const url = URL.createObjectURL(file);
        this.elements.videoPlayer.src = url;
        
        // Activate player section
        this.elements.playerSection.classList.add('active');
        
        // Make timeline visible
        if (this.elements.timelineSection) {
            this.elements.timelineSection.classList.add('active');
        }
        
        // Enable transcribe button
        this.elements.transcribeBtn.disabled = false;
        this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        this.elements.transcribeHint?.classList.add('hidden');
        
        // Wait for video to load metadata, then update the timeline
        this.elements.videoPlayer.addEventListener('loadedmetadata', () => {
            TimelineManager.updateDimensions();
            TimelineManager.render();
        }, { once: true });
        
        this.showMessage(`影片已載入: ${file.name}`, 'success');
    },
    
    /**
     * Handle SRT file selection
     */
    handleSrtFileSelect(files) {
        const file = files?.[0];
        if (!file) return;
        
        AppConfig.state.srtFile = file;
        this.elements.srtFilename.textContent = '正在讀取...';
        this.elements.srtFilename.classList.remove('hidden');
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                // Parse SRT content
                AppConfig.state.subtitles = SubtitleParser.parseSrt(e.target.result);
                
                // Update filename display
                this.elements.srtFilename.textContent = file.name;
                
                // Render subtitle list
                SubtitleEditor.renderSubtitleList();
                
                // Show subtitle editor
                setTimeout(() => {
                    this.elements.subtitleEditor.classList.add('active');
                    
                    if (AppConfig.state.videoFile) {
                        if (!this.elements.playerSection.classList.contains('active')) {
                            this.elements.playerSection.classList.add('active');
                        }
                    }
                    
                    // After parsing subtitles and rendering list
                    SubtitleEditor.renderSubtitleList();
                    
                    // Update timeline if video is loaded
                    if (AppConfig.state.videoFile && this.elements.videoPlayer.duration) {
                        TimelineManager.updateDimensions();
                        TimelineManager.render();
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
    },
    
    /**
     * Handle transcribe button click
     */
    async handleTranscribeBtn() {
        if (!AppConfig.state.videoFile) {
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
        const fileId = await ApiService.uploadFile(AppConfig.state.videoFile);
        if (!fileId) {
            apiStatus?.classList.remove('active');
            this.elements.transcribeBtn.disabled = false;
            this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            return;
        }
        
        // Start transcription
        this.elements.apiMessage.textContent = '正在開始轉錄...';
        const taskData = await ApiService.transcribeVideo(fileId);
        if (!taskData) {
            apiStatus?.classList.remove('active');
            this.elements.transcribeBtn.disabled = false;
            this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            return;
        }
        
        // Poll for status updates
        this.elements.apiMessage.textContent = '正在轉錄影片...';
        ApiService.startStatusPolling(taskData.id, async (status) => {
            if (status.status === 'completed') {
                const srtContent = await ApiService.downloadResult(status.result_url);
                if (!srtContent) {
                    this.elements.transcribeBtn.disabled = false;
                    this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    return;
                }
                
                // Create SRT file
                const srtBlob = new Blob([srtContent], { type: 'text/plain' });
                AppConfig.state.srtFile = new File([srtBlob], 'transcribed.srt', { type: 'text/plain' });
                this.elements.srtFilename.textContent = 'transcribed.srt';
                this.elements.srtFilename.classList.remove('hidden');
                
                // Parse subtitles
                AppConfig.state.subtitles = SubtitleParser.parseSrt(srtContent);
                
                // Re-enable transcribe button
                this.elements.transcribeBtn.disabled = false;
                this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                
                // Render subtitle list
                SubtitleEditor.renderSubtitleList();
                
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
                
                // Update timeline
                TimelineManager.updateDimensions();
                TimelineManager.render();
                
                this.showMessage('轉錄完成！', 'success');
            } else if (status.status === 'failed') {
                this.elements.transcribeBtn.disabled = false;
                this.elements.transcribeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    },
    
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
    },
    
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
    },
    
    /**
     * Save settings from the modal
     */
    saveSettings() {
        // Update state with form values
        AppConfig.state.apiEndpoint = this.elements.apiEndpoint.value;
        AppConfig.state.language = this.elements.languageSelect.value;
        AppConfig.state.whisperModel = this.elements.modelSelect.value;
        AppConfig.state.device = this.elements.deviceSelect.value;
        
        // Save to config (which saves to localStorage)
        AppConfig.saveSettings();
        
        // Close the modal
        this.closeModal('settings');
        this.showMessage('設定已儲存', 'success');
    },
    
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
    },
    
    /**
     * Show a message
     */
    showMessage(message, type = 'info') {
        this.showToast(message, type);
    },
    
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
};
