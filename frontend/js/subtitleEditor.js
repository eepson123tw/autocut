/**
 * subtitleEditor.js - Subtitle editing functionality
 */

const SubtitleEditor = {
    // Reference to UI elements
    elements: null,
    
    /**
     * Initialize the subtitle editor
     */
    init() {
        this.elements = UIController.elements;
        return this;
    },
    
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
            if (!AppConfig.state.videoFile && AppConfig.state.subtitles.length > 0) {
                noVideoWarning.classList.remove('hidden');
            } else {
                noVideoWarning.classList.add('hidden');
            }
        }
        
        // Create subtitle items
        AppConfig.state.subtitles.forEach((subtitle, index) => {
            const subtitleItem = document.createElement('div');
            subtitleItem.className = 'grid grid-cols-12 gap-2 p-3 border-b border-gray-200 hover:bg-gray-50 transition-colors subtitle-row';
            
            if (index === AppConfig.state.currentSubtitleIndex) {
                subtitleItem.classList.add('subtitle-active');
            }
            
            // Time display class based on video availability
            const timeClassNames = AppConfig.state.videoFile 
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
                    ${AppConfig.state.videoFile ? `
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
    },
    
    /**
     * Attach event listeners to subtitle list items
     */
    attachSubtitleItemEvents() {
        // Time click event (jump to subtitle)
        if (AppConfig.state.videoFile) {
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
                AppConfig.state.subtitles[index].text = e.currentTarget.value;
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
    },
    
    /**
     * Jump to a specific subtitle
     */
    jumpToSubtitle(index) {
        if (index >= 0 && index < AppConfig.state.subtitles.length && this.elements.videoPlayer) {
            this.elements.videoPlayer.currentTime = AppConfig.state.subtitles[index].startSeconds;
            this.elements.videoPlayer.play().catch(err => console.error('Video playback error:', err));
            this.updateCurrentSubtitle(index, true);
        }
    },
    
    /**
     * Navigate subtitles (prev, next, replay)
     */
    navigateSubtitle(direction) {
        switch (direction) {
            case 'prev':
                if (AppConfig.state.currentSubtitleIndex > 0) {
                    this.jumpToSubtitle(AppConfig.state.currentSubtitleIndex - 1);
                }
                break;
            case 'next':
                if (AppConfig.state.currentSubtitleIndex < AppConfig.state.subtitles.length - 1) {
                    this.jumpToSubtitle(AppConfig.state.currentSubtitleIndex + 1);
                }
                break;
            case 'replay':
                if (AppConfig.state.currentSubtitleIndex >= 0) {
                    this.jumpToSubtitle(AppConfig.state.currentSubtitleIndex);
                }
                break;
        }
    },
    
    /**
     * Edit a subtitle's time manually
     */
    editSubtitleTime(index) {
        // For manual time editing, use the TimelineManager's timestamp editor
        TimelineManager.openTimestampEditor(index);
    },
    
    /**
     * Update current subtitle display based on video time
     */
/**
 * Update current subtitle display based on video time
 */
updateCurrentSubtitle(forceIndex = null, scrollToView = false) {
    if (!this.elements.videoPlayer || !this.elements.currentSubtitle) return;
    
    // Don't update if we're dragging a subtitle
    if (AppConfig.state.isDraggingSubtitle) return;
    
    const currentTime = this.elements.videoPlayer.currentTime;
    let foundIndex = -1;
    
    // Use forced index or find subtitle based on current time
    if (forceIndex !== null && forceIndex >= 0 && forceIndex < AppConfig.state.subtitles.length) {
        foundIndex = forceIndex;
    } else {
        // Find subtitle that matches current time
        for (let i = 0; i < AppConfig.state.subtitles.length; i++) {
            if (currentTime >= AppConfig.state.subtitles[i].startSeconds && 
                currentTime <= AppConfig.state.subtitles[i].endSeconds) {
                foundIndex = i;
                break;
            }
        }
    }
    
    // Update only if the current subtitle has changed
    if (foundIndex !== AppConfig.state.currentSubtitleIndex) {
        // Set flag for timeline scroll only when manually jumping to a subtitle
        AppConfig.state.forceTimelineScroll = scrollToView;
        
        AppConfig.state.currentSubtitleIndex = foundIndex;
        
        if (foundIndex >= 0) {
            this.elements.currentSubtitle.innerHTML = `<span>${AppConfig.state.subtitles[foundIndex].text}</span>`;
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
        
        // Reset flag after processing
        AppConfig.state.forceTimelineScroll = false;
    }
    
    // Update timeline
    if (TimelineManager && typeof TimelineManager.render === 'function') {
        TimelineManager.updateCursor();
    }
},
    
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
            const subtitle = AppConfig.state.subtitles[index];
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
};
