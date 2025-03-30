/**
 * config.js - Configuration and state management for the application
 */

const AppConfig = {
    // Default configuration
    defaults: {
        apiEndpoint: 'http://localhost:8000',
        language: 'zh',
        whisperModel: 'small',
        device: 'cuda',
        minSubtitleDuration: 0.5, // Minimum duration in seconds
        timelineScale: 10, // Pixels per second
    },

    // Current state
    state: {
        apiEndpoint: null,
        language: null,
        whisperModel: null,
        device: null,
        subtitles: [],
        currentSubtitleIndex: -1,
        videoFile: null,
        srtFile: null,
        apiTaskId: null,
        apiStatusInterval: null,
        
        // Timeline state
        timelineZoom: 1,
        timelineOffset: 0,
        isTimelineMouseDown: false,
        isDraggingSubtitle: false,
        draggingSubtitleIndex: -1,
        draggingSubtitlePart: null,
        timelineMouseStartX: 0,
        timelineLastX: 0,
        activeTimestampEditor: null,
        timelineViewportWidth: 0,
        timelineTotalWidth: 0,
        timelineScale: 10,
        timelineRefreshInterval: null,
		addingTimeSegment: false,
		forceTimelineScroll: false,
    },

    /**
     * Initialize the configuration
     */
    init() {
        // Load settings from localStorage
        this.state.apiEndpoint = localStorage.getItem('apiEndpoint') || this.defaults.apiEndpoint;
        this.state.language = localStorage.getItem('language') || this.defaults.language;
        this.state.whisperModel = localStorage.getItem('whisperModel') || this.defaults.whisperModel;
        this.state.device = localStorage.getItem('device') || this.defaults.device;
        this.state.timelineScale = this.defaults.timelineScale;
        
        return this;
    },

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('apiEndpoint', this.state.apiEndpoint);
        localStorage.setItem('language', this.state.language);
        localStorage.setItem('whisperModel', this.state.whisperModel);
        localStorage.setItem('device', this.state.device);
    },
    
    /**
     * Reset state (useful for testing or reloading)
     */
    resetState() {
        this.state.subtitles = [];
        this.state.currentSubtitleIndex = -1;
        this.state.videoFile = null;
        this.state.srtFile = null;
        this.state.apiTaskId = null;
        
        if (this.state.apiStatusInterval) {
            clearInterval(this.state.apiStatusInterval);
            this.state.apiStatusInterval = null;
        }
        
        if (this.state.timelineRefreshInterval) {
            clearInterval(this.state.timelineRefreshInterval);
            this.state.timelineRefreshInterval = null;
        }
    }
};

// Initialize config
AppConfig.init();
