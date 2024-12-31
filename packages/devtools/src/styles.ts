export const styles = `
  .devtools-dialog {
    position: fixed;
    margin: 0;
    padding: 0;
    right: 20px;
    bottom: 20px;
    left: auto;
    top: auto;
    width: 600px;
    height: 500px;
    background: #fdf6e3;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    font-size: 12px;
    color: #657b83;
    border: 1px solid #93a1a1;
    box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 0px 1px, rgba(0, 0, 0, 0.2) 0px 2px 4px;
    overflow: hidden;
    resize: both;
  }

  .dialog-title {
    padding: 0 8px;
    height: 28px;
    line-height: 28px;
    background: #eee8d5;
    border-bottom: 1px solid #93a1a1;
    cursor: move;
    user-select: none;
    font-size: 12px;
    display: flex;
    align-items: center;
    color: #586e75;
    font-weight: 500;
  }

  .dialog-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #fdf6e3;
    height: calc(100% - 28px);
    box-sizing: border-box;
    min-height: 0;
  }

  #tabs {
    flex-shrink: 0;
    padding: 0 6px;
    height: 32px;
    border-bottom: 1px solid #93a1a1;
    background: #eee8d5;
    white-space: nowrap;
    overflow-x: auto;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .computed-select-button {
    height: 24px;
    padding: 0 12px;
    border: none;
    background: transparent;
    color: #657b83;
    cursor: pointer;
    font-size: 11px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    white-space: nowrap;
    transition: all 0.15s;
    position: relative;
  }

  .computed-select-button:hover {
    background: rgba(147, 161, 161, 0.1);
  }

  .computed-select-button:active {
    background: rgba(147, 161, 161, 0.2);
  }

  #graph {
    flex: 1;
    padding: 16px;
    background: #fdf6e3;
    overflow: hidden;
    position: relative;
    min-height: 0;
  }

  /* 滚动条样式 */
  ::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }

  ::-webkit-scrollbar-track {
    background: #fdf6e3;
  }

  ::-webkit-scrollbar-thumb {
    background: #93a1a1;
    border: 3px solid #fdf6e3;
    border-radius: 6px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #657b83;
  }

  ::-webkit-scrollbar-corner {
    background: #fdf6e3;
  }

  /* cytoscape 样式覆盖 */
  #graph .cytoscape-container {
    background: #fdf6e3 !important;
  }

  #graph .node {
    color: #657b83 !important;
    background-color: #eee8d5 !important;
    border-color: #93a1a1 !important;
    font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace !important;
    font-size: 11px !important;
  }

  #graph .node.circle {
    background-color: #268bd2 !important;
    border-color: #839496 !important;
    color: #fdf6e3 !important;
  }

  #graph .node.rectangle {
    background-color: #d33682 !important;
    border-color: #839496 !important;
    color: #fdf6e3 !important;
  }

  #graph .edge {
    color: #93a1a1 !important;
  }

  /* 错误状态样式 */
  [data-testid="debug-store-not-set"] {
    padding: 16px;
    color: #657b83;
    font-size: 13px;
    background: #fdf6e3;
    font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace;
  }
`;
