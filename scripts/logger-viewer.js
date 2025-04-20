import van from './thirdparty/van.js';
import jss from './thirdparty/jss.js';
import { genStyle } from './core/common.js';


/**
 * @interface
 * @typedef {Object} LoggerMessage
 * @property {string} level
 * @property {string} message
 * @property {Date} timestamp
 */

class LoggerViewer {
    constructor(options = {}) {
        this.maxEntries = options.maxEntries || 1000;
        this.showTimestamp = options.showTimestamp !== false;
        this.showLevel = options.showLevel !== false;

        const { classes } = jss.createStyleSheet({
            loggerContainer: {
                fontFamily: 'monospace',
                border: '1px solid #ccc',
                borderRadius: '4px',
                padding: '10px',
                overflowY: 'auto',
                backgroundColor: '#f8f8f8'
            },
            logList: {
                display: 'flex',
                'flex-direction': 'column',
                'justify-content': 'start',
            },
            logEntry: {
                marginBottom: '4px',
                padding: '2px 4px',
                borderRadius: '2px'
            },
            logTimestamp: {
                color: '#666',
                marginRight: '8px'
            },
            logLevel: {
                fontWeight: 'bold',
                marginRight: '8px'
            },
            logLevelDebug: { color: '#666' },
            logLevelInfo: { color: '#2196F3' },
            logLevelWarn: { color: '#FF9800' },
            logLevelError: { color: '#F44336' }
        }).attach();
        this.m_classes = classes;

        /** @type LoggerMessage[] */
        this.logEntries = van.reactive([]);
    }

    _addLog(level, message) {
        const timestamp = new Date();
        const newEntry = { level, message, timestamp };
        this.logEntries.push(van.noreactive(newEntry));
    }

    debug(message) {
        this._addLog('debug', message);
    }

    info(message) {
        this._addLog('info', message);
    }

    warn(message) {
        this._addLog('warn', message);
    }

    error(message) {
        this._addLog('error', message);
    }

    clear() {
        this.logEntries.splice(0);
    }

    render() {
        return van.tags.div({ class: `${this.m_classes.loggerContainer}` },
            () => van.tags.div(
                {
                    style: genStyle({
                        padding: "1em 0.5em",
                        'text-align': 'center',
                        'font-size': 'medium',
                        'user-select': 'none',
                        'border-bottom': '1pt black solid',
                    }),
                }, "Logger Viewer"),
            van.list(
                van.tags.ul(
                    { class: `${this.m_classes.logList}` },
                ),
                this.logEntries || [],
                /** @param {LoggerMessage} entry */
                entry => {
                    entry = entry.val;
                    const Level = entry.level.substring(0, 1).toUpperCase() + entry.level.substring(1);
                    const DateStr = entry.timestamp.toLocaleTimeString();
                    return van.tags.li(
                        { class: `${this.m_classes.logEntry}` }, [
                        this.showTimestamp && van.tags.span({ class: `${this.m_classes.logTimestamp}` }, `[${DateStr}]`),
                        this.showLevel && van.tags.span(
                            { class: `${this.m_classes.logLevel} ${this.m_classes['logLevel' + Level]}` },
                            `${entry.level.toUpperCase()}:`
                        ),
                        van.tags.span(entry.message)
                    ]);
                }));

    }
}

export { LoggerViewer }
