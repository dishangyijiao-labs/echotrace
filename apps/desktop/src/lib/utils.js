/**
 * 格式化 ISO 8601 UTC 时间为本地时间
 * @param {string} isoString - ISO 8601 格式的时间字符串（如 "2026-01-28T13:54:17Z"）
 * @param {boolean} showSeconds - 是否显示秒，默认为 true
 * @returns {string} 格式化后的本地时间（如 "2026-01-28 21:54:17"）
 */
export function formatDateTime(isoString, showSeconds = true) {
  if (!isoString) return "-";
  
  try {
    const date = new Date(isoString);
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return isoString;
    }
    
    // 格式化为本地时间（会自动根据系统时区显示）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    if (showSeconds) {
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return isoString;
  }
}

/**
 * 格式化为相对时间（如 "3分钟前"、"2小时前"）
 * @param {string} isoString - ISO 8601 格式的时间字符串
 * @returns {string} 相对时间描述
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return "-";
  
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return "刚刚";
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;
    
    // 超过 7 天显示完整日期
    return formatDateTime(isoString, false);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return isoString;
  }
}

/**
 * 格式化媒体时长（秒）为可读格式
 * @param {number} seconds - 时长（秒）
 * @returns {string} 格式化后的时长（如 "01:23:45"）
 */
export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return "-";
  
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  
  return `${h.toString().padStart(2, "0")}:${m
    .toString()
    .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
