/**
 * timeUtils.js - Utilities for working with time formats
 */

const TimeUtils = {
    /**
     * Format seconds to SRT time format (HH:MM:SS,mmm)
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted SRT time
     */
    formatSrtTime(seconds) {
        const date = new Date(seconds * 1000);
        const hours = date.getUTCHours().toString().padStart(2, '0');
        const minutes = date.getUTCMinutes().toString().padStart(2, '0');
        const secs = date.getUTCSeconds().toString().padStart(2, '0');
        const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
        return `${hours}:${minutes}:${secs},${ms}`;
    },
    
    /**
     * Convert SRT time format to seconds
     * @param {string} srtTime - Time in SRT format (HH:MM:SS,mmm)
     * @returns {number} Time in seconds
     */
    srtTimeToSeconds(srtTime) {
        const parts = srtTime.split(':');
        const seconds = parts[2].split(',');
        return parseInt(parts[0]) * 3600 + 
               parseInt(parts[1]) * 60 + 
               parseInt(seconds[0]) + 
               parseInt(seconds[1]) / 1000;
    },
    
    /**
     * Format time for timeline markers (MM:SS)
     * @param {number} seconds - Time in seconds
     * @returns {string} Formatted time for timeline
     */
    formatTimeForTimeline(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    /**
     * Calculate appropriate interval for time markers based on zoom level
     * @param {number} zoom - Zoom level
     * @returns {number} Marker interval in seconds
     */
    calculateMarkerInterval(zoom) {
        if (zoom <= 0.8) return 60; // Every minute
        if (zoom <= 1.2) return 30; // Every 30 seconds
        if (zoom <= 2) return 10; // Every 10 seconds
        if (zoom <= 3) return 5; // Every 5 seconds
        return 1; // Every second for high zoom levels
    },
    
    /**
     * Parse time inputs into total seconds
     * @param {Object} inputs - Object containing hours, minutes, seconds, milliseconds
     * @returns {number} Time in seconds
     */
    parseTimeInputs(inputs) {
        const hours = parseInt(inputs.hours) || 0;
        const minutes = parseInt(inputs.minutes) || 0;
        const seconds = parseInt(inputs.seconds) || 0;
        const milliseconds = parseInt(inputs.milliseconds) || 0;
        
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }
};
