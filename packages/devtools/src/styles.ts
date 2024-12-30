export const styles = `
.ccstate-inspector {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
    'Helvetica Neue', sans-serif;
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin: 10px;
  max-width: 100%;
  overflow: hidden;
}

.inspector-header {
  background: #f5f5f5;
  padding: 10px 15px;
  font-weight: 600;
  border-bottom: 1px solid #e0e0e0;
}

.inspector-content {
  padding: 15px;
  overflow: auto;
  max-height: 400px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}

.devtools-dialog {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 600px;
  height: 500px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  resize: both;
  z-index: 10000;
}

.dialog-title {
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  cursor: move;
  user-select: none;
  font-weight: bold;
}

.dialog-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  height: calc(100% - 48px);
  box-sizing: border-box;
}

#tabs {
  flex-shrink: 0;
  margin-bottom: 16px;
  white-space: nowrap;
  overflow-x: auto;
}

.computed-select-button {
  margin-right: 8px;
  padding: 6px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.computed-select-button:hover {
  background: #f5f5f5;
}

#graph {
  flex: 1;
  min-height: 200px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
`;
