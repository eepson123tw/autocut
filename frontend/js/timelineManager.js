/**
 * timelineManager.js - Managing timeline visualization and interaction
 */

const TimelineManager = {
    // Reference to UI elements
    elements: null,
    
    /**
     * Initialize the timeline manager
     */
    init() {
        this.elements = UIController.elements;
        
        if (!this.elements.timeline) return;
        
        this.setupEvents();
        
        // Setup periodic refresh for timeline cursor
        if (AppConfig.state.timelineRefreshInterval) {
            clearInterval(AppConfig.state.timelineRefreshInterval);
        }
        
        AppConfig.state.timelineRefreshInterval = setInterval(() => {
            this.updateCursor();
        }, 100);
        
        return this;
    },
    
    /**
     * Setup event listeners for timeline interactions
     */
    setupEvents() {
        if (!this.elements.timeline) return;
        
        // Timeline container mouse events
        this.elements.timelineContainer.addEventListener('mousedown', (e) => {
            if (e.target === this.elements.timelineContainer || e.target === this.elements.timelineContent) {
                AppConfig.state.isTimelineMouseDown = true;
                AppConfig.state.timelineMouseStartX = e.clientX;
                AppConfig.state.timelineLastX = AppConfig.state.timelineOffset;
                this.elements.timelineContainer.style.cursor = 'grabbing';
            }
        });
        
        // Window events to handle dragging outside the timeline
        window.addEventListener('mousemove', (e) => {
            if (AppConfig.state.isTimelineMouseDown) {
                const deltaX = AppConfig.state.timelineMouseStartX - e.clientX;
                let newOffset = AppConfig.state.timelineLastX + deltaX;
                
                // Limit scrolling to valid range
                newOffset = Math.max(0, Math.min(newOffset, AppConfig.state.timelineTotalWidth - AppConfig.state.timelineViewportWidth));
                
                this.elements.timelineContainer.scrollLeft = newOffset;
                AppConfig.state.timelineOffset = newOffset;
            } else if (AppConfig.state.isDraggingSubtitle && AppConfig.state.draggingSubtitleIndex >= 0) {
                this.handleSubtitleDragging(e);
            }
        });
        
        window.addEventListener('mouseup', () => {
            if (AppConfig.state.isTimelineMouseDown) {
                AppConfig.state.isTimelineMouseDown = false;
                this.elements.timelineContainer.style.cursor = 'default';
            }
            
            if (AppConfig.state.isDraggingSubtitle) {
                AppConfig.state.isDraggingSubtitle = false;
                AppConfig.state.draggingSubtitleIndex = -1;
                AppConfig.state.draggingSubtitlePart = null;
                document.body.style.cursor = 'default';
            }
        });
        
        // Click on timeline to seek
        this.elements.timelineContent.addEventListener('click', (e) => {
            if (e.target === this.elements.timelineContent) {
                const rect = this.elements.timelineContent.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const seekTime = (clickX / (AppConfig.state.timelineScale * AppConfig.state.timelineZoom));
                
                if (this.elements.videoPlayer) {
                    this.elements.videoPlayer.currentTime = seekTime;
                }
            }
        });
        
        // Zoom controls
        this.elements.timelineZoomIn?.addEventListener('click', () => {
            this.zoom(1.2); // Zoom in by 20%
        });
        
        this.elements.timelineZoomOut?.addEventListener('click', () => {
            this.zoom(0.8); // Zoom out by 20%
        });

		this.elements.timelineContent.addEventListener('click', (e) => {
			if (e.target === this.elements.timelineContent) {
				const rect = this.elements.timelineContent.getBoundingClientRect();
				const clickX = e.clientX - rect.left;
				const clickTime = (clickX / (AppConfig.state.timelineScale * AppConfig.state.timelineZoom));
				
				// Check if the Add Segment button was pressed while clicking
				if (AppConfig.state.addingTimeSegment) {
					this.addNewSubtitleSegment(clickTime);
					// Reset the adding state
					AppConfig.state.addingTimeSegment = false;
					document.getElementById('add-timeline-segment').classList.remove('bg-green-500');
					document.getElementById('add-timeline-segment').classList.add('bg-gray-100');
				} else if (this.elements.videoPlayer) {
					// Normal behavior - just seek to the time
					this.elements.videoPlayer.currentTime = clickTime;
				}
			}
		});

		this.elements.addTimelineSegment = document.getElementById('add-timeline-segment');
		if (this.elements.addTimelineSegment) {
			this.elements.addTimelineSegment.addEventListener('click', () => {
				// Toggle the adding state
				AppConfig.state.addingTimeSegment = !AppConfig.state.addingTimeSegment;
				
				if (AppConfig.state.addingTimeSegment) {
					// Highlight button when active
					this.elements.addTimelineSegment.classList.remove('bg-gray-100');
					this.elements.addTimelineSegment.classList.add('bg-green-500');
					this.elements.addTimelineSegment.classList.add('text-white');
					UIController.showMessage('請點擊時間軸以新增字幕段落', 'info');
				} else {
					// Reset button style
					this.elements.addTimelineSegment.classList.remove('bg-green-500');
					this.elements.addTimelineSegment.classList.remove('text-white');
					this.elements.addTimelineSegment.classList.add('bg-gray-100');
				}
			});
		}
        
        // Window resize event
        window.addEventListener('resize', () => {
            this.updateDimensions();
            this.render();
        });
    },
    
    /**
     * Update timeline dimensions when window resizes
     */
    updateDimensions() {
        if (!this.elements.timelineContainer) return;
        
        AppConfig.state.timelineViewportWidth = this.elements.timelineContainer.clientWidth;
        
        if (this.elements.videoPlayer && this.elements.videoPlayer.duration) {
            AppConfig.state.timelineTotalWidth = this.elements.videoPlayer.duration * 
                AppConfig.state.timelineScale * 
                AppConfig.state.timelineZoom;
            
            if (this.elements.timelineContent) {
                this.elements.timelineContent.style.width = `${AppConfig.state.timelineTotalWidth}px`;
            }
        }
    },
    
    /**
     * Zoom the timeline
     * @param {number} factor - Zoom factor (>1 to zoom in, <1 to zoom out)
     */
    zoom(factor) {
        const oldZoom = AppConfig.state.timelineZoom;
        const newZoom = Math.max(0.5, Math.min(5, oldZoom * factor)); // Limit zoom between 0.5x and 5x
        
        // Get the center point of the current view
        const viewportCenter = AppConfig.state.timelineOffset + (AppConfig.state.timelineViewportWidth / 2);
        const centerTimeRatio = viewportCenter / (AppConfig.state.timelineTotalWidth);
        
        // Update zoom and total width
        AppConfig.state.timelineZoom = newZoom;
        this.updateDimensions();
        
        // Adjust offset to keep the center point in view
        const newCenter = centerTimeRatio * AppConfig.state.timelineTotalWidth;
        const newOffset = newCenter - (AppConfig.state.timelineViewportWidth / 2);
        AppConfig.state.timelineOffset = Math.max(0, Math.min(newOffset, AppConfig.state.timelineTotalWidth - AppConfig.state.timelineViewportWidth));
        this.elements.timelineContainer.scrollLeft = AppConfig.state.timelineOffset;
        
        // Re-render timeline with new zoom level
        this.render();
    },
    
    /**
     * Render the timeline component
     */
    render() {
        if (!this.elements.timelineContent) {
            console.warn('Timeline content element not found');
            return;
        }
        
        if (!this.elements.videoPlayer || !this.elements.videoPlayer.duration) {
            console.log('Video player not ready or duration not available');
            return;
        }
        
        // Clear existing content
        this.elements.timelineContent.innerHTML = '';
        
        // Calculate time markers based on zoom level
        const duration = this.elements.videoPlayer.duration || 0;
        const markerInterval = TimeUtils.calculateMarkerInterval(AppConfig.state.timelineZoom);
        
        // Set a reasonable width for timeline content based on video duration
        const timelineWidth = Math.max(5000, duration * AppConfig.state.timelineScale * AppConfig.state.timelineZoom);
        this.elements.timelineContent.style.width = `${timelineWidth}px`;
        AppConfig.state.timelineTotalWidth = timelineWidth;
        
        // Create time markers
        for (let time = 0; time <= duration; time += markerInterval) {
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            const leftPos = time * AppConfig.state.timelineScale * AppConfig.state.timelineZoom;
            marker.style.left = `${leftPos}px`;
            
            const label = document.createElement('div');
            label.className = 'timeline-marker-label';
            label.textContent = TimeUtils.formatTimeForTimeline(time);
            
            marker.appendChild(label);
            this.elements.timelineContent.appendChild(marker);
        }
        
        // Check if we have subtitles to render
        if (!AppConfig.state.subtitles || AppConfig.state.subtitles.length === 0) {
            console.log('No subtitles to render in timeline');
            return;
        }
        
        // Render subtitle blocks on timeline
        AppConfig.state.subtitles.forEach((subtitle, index) => {
            const subtitleBlock = document.createElement('div');
            subtitleBlock.className = 'timeline-subtitle';
            subtitleBlock.setAttribute('data-index', index);
            
            if (index === AppConfig.state.currentSubtitleIndex) {
                subtitleBlock.classList.add('timeline-subtitle-active');
            }
            
            const startPos = subtitle.startSeconds * AppConfig.state.timelineScale * AppConfig.state.timelineZoom;
            const endPos = subtitle.endSeconds * AppConfig.state.timelineScale * AppConfig.state.timelineZoom;
            const width = endPos - startPos;
            
            subtitleBlock.style.left = `${startPos}px`;
            subtitleBlock.style.width = `${width}px`;
            
            // Add handles for dragging
            const startHandle = document.createElement('div');
            startHandle.className = 'subtitle-handle subtitle-start-handle';
            startHandle.setAttribute('data-index', index);
            startHandle.setAttribute('data-part', 'start');
            
            const endHandle = document.createElement('div');
            endHandle.className = 'subtitle-handle subtitle-end-handle';
            endHandle.setAttribute('data-index', index);
            endHandle.setAttribute('data-part', 'end');
            
            // Add truncated subtitle text
            const subtitleText = document.createElement('div');
            subtitleText.className = 'timeline-subtitle-text';
            subtitleText.textContent = this.truncateSubtitleText(subtitle.text, width);
            subtitleText.setAttribute('data-index', index);
            subtitleText.setAttribute('data-part', 'middle');
            
            subtitleBlock.appendChild(startHandle);
            subtitleBlock.appendChild(subtitleText);
            subtitleBlock.appendChild(endHandle);
            
            // Add event listeners for dragging
            startHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startSubtitleDragging(index, 'start', e);
            });
            
            endHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startSubtitleDragging(index, 'end', e);
            });
            
            subtitleText.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startSubtitleDragging(index, 'middle', e);
            });
            
            // Double click to edit timestamp precisely
            subtitleBlock.addEventListener('dblclick', () => {
                this.openTimestampEditor(index);
            });
            
            this.elements.timelineContent.appendChild(subtitleBlock);
        });
        
        // Update cursor position
        this.updateCursor();
    },
    
    /**
     * Update timeline cursor position based on current video time
     */
    updateCursor() {
        if (!this.elements.timelineCursor || !this.elements.videoPlayer) return;
        
        const currentTime = this.elements.videoPlayer.currentTime || 0;
        const cursorPos = currentTime * AppConfig.state.timelineScale * AppConfig.state.timelineZoom;
        
        this.elements.timelineCursor.style.left = `${cursorPos}px`;
        
        if (this.elements.timelineCurrentTime) {
            this.elements.timelineCurrentTime.textContent = TimeUtils.formatSrtTime(currentTime).replace(',', '.');
        }
        
        // Auto-scroll timeline if cursor is near edges
        this.autoScrollTimeline(cursorPos);
    },
    
    /**
     * Auto-scroll timeline if cursor is near edges
     */autoScrollTimeline(cursorPos) {
    if (!this.elements.timelineContainer) return;
    
    // Skip auto-scrolling if video is playing normally
    if (this.elements.videoPlayer && !this.elements.videoPlayer.paused && !AppConfig.state.forceTimelineScroll) {
        return;
    }
    
    const scrollLeft = this.elements.timelineContainer.scrollLeft;
    const viewportWidth = AppConfig.state.timelineViewportWidth;
    
    // Only scroll if cursor is significantly outside the visible area
    const margin = viewportWidth * 0.1; // 10% margin
    if (cursorPos < scrollLeft + margin || cursorPos > scrollLeft + viewportWidth - margin) {
        this.elements.timelineContainer.scrollLeft = Math.max(0, cursorPos - (viewportWidth / 2));
        AppConfig.state.timelineOffset = this.elements.timelineContainer.scrollLeft;
    }
},
    
    /**
     * Truncate subtitle text to fit in timeline block
     */
    truncateSubtitleText(text, width) {
        // Estimate 6px per character (rough approximation)
        const maxChars = Math.floor(width / 6);
        if (text.length <= maxChars) return text;
        
        return text.substring(0, maxChars - 3) + '...';
    },
    
    /**
     * Start dragging a subtitle on timeline
     */
    startSubtitleDragging(index, part, event) {
        AppConfig.state.isDraggingSubtitle = true;
        AppConfig.state.draggingSubtitleIndex = index;
        AppConfig.state.draggingSubtitlePart = part;
        AppConfig.state.timelineMouseStartX = event.clientX;
        
        // Change cursor based on what's being dragged
        if (part === 'start') {
            document.body.style.cursor = 'w-resize';
        } else if (part === 'end') {
            document.body.style.cursor = 'e-resize';
        } else {
            document.body.style.cursor = 'move';
        }
        
        // Store original times
        const subtitle = AppConfig.state.subtitles[index];
        AppConfig.state.draggingOriginalStart = subtitle.startSeconds;
        AppConfig.state.draggingOriginalEnd = subtitle.endSeconds;
        
        event.preventDefault();
        event.stopPropagation();
    },
    
    /**
     * Handle subtitle dragging on timeline
     */
    handleSubtitleDragging(event) {
        const index = AppConfig.state.draggingSubtitleIndex;
        if (index < 0 || index >= AppConfig.state.subtitles.length) return;
        
        const subtitle = AppConfig.state.subtitles[index];
        const deltaX = event.clientX - AppConfig.state.timelineMouseStartX;
        const deltaTime = deltaX / (AppConfig.state.timelineScale * AppConfig.state.timelineZoom);
        
        // Original times to manipulate
        let newStartTime = AppConfig.state.draggingOriginalStart;
        let newEndTime = AppConfig.state.draggingOriginalEnd;
        
        // Apply changes based on what's being dragged
        if (AppConfig.state.draggingSubtitlePart === 'start') {
            // Dragging start handle - adjust start time
            newStartTime = Math.max(0, AppConfig.state.draggingOriginalStart + deltaTime);
            
            // Ensure minimum duration
            if (newEndTime - newStartTime < AppConfig.defaults.minSubtitleDuration) {
                newStartTime = newEndTime - AppConfig.defaults.minSubtitleDuration;
            }
        } else if (AppConfig.state.draggingSubtitlePart === 'end') {
            // Dragging end handle - adjust end time
            newEndTime = Math.max(0, AppConfig.state.draggingOriginalEnd + deltaTime);
            
            // Ensure minimum duration
            if (newEndTime - newStartTime < AppConfig.defaults.minSubtitleDuration) {
                newEndTime = newStartTime + AppConfig.defaults.minSubtitleDuration;
            }
        } else {
            // Dragging entire subtitle - move both start and end
            newStartTime = Math.max(0, AppConfig.state.draggingOriginalStart + deltaTime);
            newEndTime = Math.max(0, AppConfig.state.draggingOriginalEnd + deltaTime);
        }
        
        // Update subtitle times
        SubtitleParser.updateSubtitleTime(subtitle, newStartTime, newEndTime);
        
        // Update timeline view
        this.render();
    },

	// Add this method to TimelineManager
addNewSubtitleSegment(clickTime) {
    // Get the next subtitle number
    const nextNumber = AppConfig.state.subtitles.length > 0 
        ? Math.max(...AppConfig.state.subtitles.map(s => s.number)) + 1 
        : 1;
    
    // Create a new subtitle with default duration (e.g., 3 seconds)
    const startTime = clickTime;
    const endTime = startTime + 3; // 3 seconds default duration
    
    // Format times to SRT format
    const startTimeStr = TimeUtils.formatSrtTime(startTime);
    const endTimeStr = TimeUtils.formatSrtTime(endTime);
    
    // Create new subtitle object
    const newSubtitle = {
        number: nextNumber,
        startTime: startTimeStr,
        endTime: endTimeStr,
        text: "新字幕",
        startSeconds: startTime,
        endSeconds: endTime
    };
    
    // Add to subtitles list
    AppConfig.state.subtitles.push(newSubtitle);
    
    // Sort subtitles by start time
    AppConfig.state.subtitles.sort((a, b) => a.startSeconds - b.startSeconds);
    
    // Renumber subtitles
    AppConfig.state.subtitles.forEach((subtitle, index) => {
        subtitle.number = index + 1;
    });
    
    // Update UI
    SubtitleEditor.renderSubtitleList();
    this.render();
    
    // Open editor for the new subtitle
    const newIndex = AppConfig.state.subtitles.findIndex(s => 
        s.startTime === startTimeStr && s.endTime === endTimeStr
    );
    if (newIndex >= 0) {
        this.openTimestampEditor(newIndex);
    }
    
    UIController.showMessage('已新增字幕段落', 'success');
},
    
    /**
     * Open the timestamp editor modal
     */
/**
 * Open the timestamp editor modal with delete capability
 */
openTimestampEditor(index) {
    const subtitle = AppConfig.state.subtitles[index];
    if (!subtitle) return;
    
    AppConfig.state.activeTimestampEditor = index;
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('timestamp-editor-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'timestamp-editor-modal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden fade-in';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 mx-4';
        
        modalContent.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold text-indigo-700">編輯時間軸</h2>
                <button id="close-timestamp-editor" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="block text-gray-700 mb-2">字幕文字</label>
                    <textarea id="timestamp-editor-text" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 subtitle-text" rows="3"></textarea>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-gray-700 mb-2">開始時間</label>
                        <div class="flex space-x-1">
                            <input type="number" id="start-hours" min="0" max="23" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="時">
                            <span class="flex items-center">:</span>
                            <input type="number" id="start-minutes" min="0" max="59" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="分">
                            <span class="flex items-center">:</span>
                            <input type="number" id="start-seconds" min="0" max="59" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="秒">
                            <span class="flex items-center">.</span>
                            <input type="number" id="start-milliseconds" min="0" max="999" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="毫秒">
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-gray-700 mb-2">結束時間</label>
                        <div class="flex space-x-1">
                            <input type="number" id="end-hours" min="0" max="23" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="時">
                            <span class="flex items-center">:</span>
                            <input type="number" id="end-minutes" min="0" max="59" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="分">
                            <span class="flex items-center">:</span>
                            <input type="number" id="end-seconds" min="0" max="59" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="秒">
                            <span class="flex items-center">.</span>
                            <input type="number" id="end-milliseconds" min="0" max="999" class="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center" placeholder="毫秒">
                        </div>
                    </div>
                </div>
                
                <div>
                    <label class="block text-gray-700 mb-2">持續時間</label>
                    <div class="text-xl font-bold text-center py-2 bg-gray-100 rounded-lg" id="duration-display"></div>
                </div>
            </div>
            
            <div class="mt-6 flex justify-between">
                <button id="delete-subtitle" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors hover-scale">
                    <i class="fas fa-trash-alt mr-1"></i> 刪除字幕
                </button>
                
                <div class="flex space-x-2">
                    <button id="apply-timestamp" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors hover-scale">
                        應用時間軸
                    </button>
                    <button id="jump-to-subtitle" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors hover-scale">
                        跳至此字幕
                    </button>
                </div>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.getElementById('timestamp-editor-modal-container').appendChild(modal);
        
        // Event listeners
        document.getElementById('close-timestamp-editor').addEventListener('click', () => {
            this.closeTimestampEditor();
        });
        
        document.getElementById('apply-timestamp').addEventListener('click', () => {
            this.applyTimestampChanges();
        });
        
        document.getElementById('jump-to-subtitle').addEventListener('click', () => {
            SubtitleEditor.jumpToSubtitle(AppConfig.state.activeTimestampEditor);
            this.closeTimestampEditor();
        });
        
        // Add delete button event listener
        document.getElementById('delete-subtitle').addEventListener('click', () => {
            this.deleteSubtitle(AppConfig.state.activeTimestampEditor);
        });
        
        // Update duration display when times change
        const timeInputs = ['start-hours', 'start-minutes', 'start-seconds', 'start-milliseconds', 
                           'end-hours', 'end-minutes', 'end-seconds', 'end-milliseconds'];
        
        timeInputs.forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                this.updateDurationDisplay();
            });
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeTimestampEditor();
            }
        });
    }
    
    // Populate fields with current values
    document.getElementById('timestamp-editor-text').value = subtitle.text;
    
    // Parse SRT times to fill input fields
    const startTimeParts = subtitle.startTime.split(/[,:]/);
    const endTimeParts = subtitle.endTime.split(/[,:]/);
    
    document.getElementById('start-hours').value = parseInt(startTimeParts[0]);
    document.getElementById('start-minutes').value = parseInt(startTimeParts[1]);
    document.getElementById('start-seconds').value = parseInt(startTimeParts[2]);
    document.getElementById('start-milliseconds').value = parseInt(startTimeParts[3]);
    
    document.getElementById('end-hours').value = parseInt(endTimeParts[0]);
    document.getElementById('end-minutes').value = parseInt(endTimeParts[1]);
    document.getElementById('end-seconds').value = parseInt(endTimeParts[2]);
    document.getElementById('end-milliseconds').value = parseInt(endTimeParts[3]);
    
    // Calculate and display duration
    this.updateDurationDisplay();
    
    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.add('active');
    }, 10);
},

/**
 * Delete a subtitle
 */
deleteSubtitle(index) {
    if (index < 0 || index >= AppConfig.state.subtitles.length) return;
    
    // Confirm before deletion
    if (confirm('確定要刪除此字幕嗎？此操作無法還原。')) {
        // Remove the subtitle from the array
        AppConfig.state.subtitles.splice(index, 1);
        
        // Renumber subtitles
        AppConfig.state.subtitles.forEach((subtitle, idx) => {
            subtitle.number = idx + 1;
        });
        
        // Close the editor
        this.closeTimestampEditor();
        
        // Update UI
        SubtitleEditor.renderSubtitleList();
        this.render();
        
        UIController.showMessage('字幕已刪除', 'success');
    }
},
    
    /**
     * Update duration display in timestamp editor
     */
    updateDurationDisplay() {
        const startHours = parseInt(document.getElementById('start-hours').value) || 0;
        const startMinutes = parseInt(document.getElementById('start-minutes').value) || 0;
        const startSeconds = parseInt(document.getElementById('start-seconds').value) || 0;
        const startMilliseconds = parseInt(document.getElementById('start-milliseconds').value) || 0;
        
        const endHours = parseInt(document.getElementById('end-hours').value) || 0;
        const endMinutes = parseInt(document.getElementById('end-minutes').value) || 0;
        const endSeconds = parseInt(document.getElementById('end-seconds').value) || 0;
        const endMilliseconds = parseInt(document.getElementById('end-milliseconds').value) || 0;
        
        const startTotalSeconds = (startHours * 3600) + (startMinutes * 60) + startSeconds + (startMilliseconds / 1000);
        const endTotalSeconds = (endHours * 3600) + (endMinutes * 60) + endSeconds + (endMilliseconds / 1000);
        
        let durationSeconds = endTotalSeconds - startTotalSeconds;
        if (durationSeconds < 0) durationSeconds = 0;
        
        const durationDisplay = document.getElementById('duration-display');
        durationDisplay.textContent = `${durationSeconds.toFixed(3)} 秒`;
        
        // Highlight in red if duration is too short
        if (durationSeconds < AppConfig.defaults.minSubtitleDuration) {
            durationDisplay.classList.add('text-red-600');
        } else {
            durationDisplay.classList.remove('text-red-600');
        }
    },
    
    /**
     * Close the timestamp editor modal
     */
    closeTimestampEditor() {
        const modal = document.getElementById('timestamp-editor-modal');
        if (!modal) return;
        
        modal.classList.remove('active');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
        
        AppConfig.state.activeTimestampEditor = null;
    },
    
    /**
     * Apply changes from timestamp editor
     */
    applyTimestampChanges() {
        const index = AppConfig.state.activeTimestampEditor;
        if (index === null || index < 0 || index >= AppConfig.state.subtitles.length) return;
        
        const subtitle = AppConfig.state.subtitles[index];
        
        // Get values from inputs
        const startHours = document.getElementById('start-hours').value.toString().padStart(2, '0');
        const startMinutes = document.getElementById('start-minutes').value.toString().padStart(2, '0');
        const startSeconds = document.getElementById('start-seconds').value.toString().padStart(2, '0');
        const startMilliseconds = document.getElementById('start-milliseconds').value.toString().padStart(3, '0');
        
        const endHours = document.getElementById('end-hours').value.toString().padStart(2, '0');
        const endMinutes = document.getElementById('end-minutes').value.toString().padStart(2, '0');
        const endSeconds = document.getElementById('end-seconds').value.toString().padStart(2, '0');
        const endMilliseconds = document.getElementById('end-milliseconds').value.toString().padStart(3, '0');
        
        // Format new times
        const newStartTime = `${startHours}:${startMinutes}:${startSeconds},${startMilliseconds}`;
        const newEndTime = `${endHours}:${endMinutes}:${endSeconds},${endMilliseconds}`;
        
        // Update subtitle text
        const newText = document.getElementById('timestamp-editor-text').value;
        
        // Update subtitle object
        subtitle.startTime = newStartTime;
        subtitle.endTime = newEndTime;
        subtitle.text = newText;
        subtitle.startSeconds = TimeUtils.srtTimeToSeconds(newStartTime);
        subtitle.endSeconds = TimeUtils.srtTimeToSeconds(newEndTime);
        
        // Update display
        SubtitleEditor.renderSubtitleList();
        this.render();
        
        // Close the editor
        this.closeTimestampEditor();
        
        UIController.showMessage('時間軸已更新', 'success');
    }
};
