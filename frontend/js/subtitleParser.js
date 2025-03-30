/**
 * subtitleParser.js - Parse and export subtitle files
 */

const SubtitleParser = {
    /**
     * Parse SRT content into subtitle objects
     * @param {string} content - SRT file content
     * @returns {Array} Array of subtitle objects
     */
    parseSrt(content) {
       try {
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
                startSeconds: TimeUtils.srtTimeToSeconds(startTime),
                endSeconds: TimeUtils.srtTimeToSeconds(endTime)
            });
        }
        
            return result;
        } catch (error) {
            console.error('SRT parsing error:', error);
            if (UIController) UIController.showError(`SRT 檔案解析失敗: ${error.message}`);
            throw error; // Re-throw to allow caller to handle it
        }
    },
    
    /**
     * Generate SRT content from subtitle objects
     * @param {Array} subtitles - Array of subtitle objects
     * @returns {string} SRT content
     */
    generateSrt(subtitles) {
        if (!subtitles || subtitles.length === 0) {
            return '';
        }
        
        let content = '';
        
        subtitles.forEach(subtitle => {
            content += `${subtitle.number}\n`;
            content += `${subtitle.startTime} --> ${subtitle.endTime}\n`;
            content += `${subtitle.text}\n\n`;
        });
        
        return content;
    },
    
    /**
     * Export subtitles as SRT file
     * @param {Array} subtitles - Array of subtitle objects
     * @param {string} filename - Output filename
     */
    exportSrt(subtitles, filename = 'edited.srt') {
        if (!subtitles || subtitles.length === 0) {
            UIController.showError('沒有可匯出的字幕');
            return false;
        }
        
        const content = this.generateSrt(subtitles);
        
        // Create and download file
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        UIController.showMessage('SRT 檔案匯出成功', 'success');
        return true;
    },
    
    /**
     * Create a subtitle object
     * @param {number} number - Subtitle number
     * @param {string} startTime - Start time
     * @param {string} endTime - End time
     * @param {string} text - Subtitle text
     * @returns {Object} Subtitle object
     */
    createSubtitle(number, startTime, endTime, text) {
        return {
            number,
            startTime,
            endTime,
            text,
            startSeconds: TimeUtils.srtTimeToSeconds(startTime),
            endSeconds: TimeUtils.srtTimeToSeconds(endTime)
        };
    },
    
    /**
     * Update a subtitle's time
     * @param {Object} subtitle - Subtitle object
     * @param {number} startSeconds - New start time in seconds
     * @param {number} endSeconds - New end time in seconds
     * @returns {Object} Updated subtitle object
     */
    updateSubtitleTime(subtitle, startSeconds, endSeconds) {
        subtitle.startSeconds = startSeconds;
        subtitle.endSeconds = endSeconds;
        subtitle.startTime = TimeUtils.formatSrtTime(startSeconds);
        subtitle.endTime = TimeUtils.formatSrtTime(endSeconds);
        return subtitle;
    }
};
