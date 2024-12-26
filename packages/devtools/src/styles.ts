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
`;
