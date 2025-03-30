/**
 * main.js - Entry point for the AutoCut subtitle editor application
 */

document.addEventListener('DOMContentLoaded', () => {
     // Initialize config first
    AppConfig.init();
    
    // Then initialize UI controller
    UIController.init();
    
    // Only after UI is initialized, setup other components
    TimelineManager.init();
    SubtitleEditor.init();
    
    // Setup page protection
    setupNetworkMonitoring();
    setupPageProtection();
    
    console.log('AutoCut Subtitle Editor initialized');
});

/**
 * Setup monitoring for network requests
 */
function setupNetworkMonitoring() {
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
function setupPageProtection() {
    window.addEventListener('beforeunload', (e) => {
        if (AppConfig.state.subtitles.length > 0) {
            console.warn('頁面卸載嘗試，但有未保存的字幕數據');
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });
}
