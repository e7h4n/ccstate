import babel from '@babel/core';
import type { PluginObj } from '@babel/core';
import { isAtom } from './utils';
import type { PluginOptions } from './utils';
import { templateBuilder } from './template';

const buildExport = templateBuilder(`
    const %%atomIdentifier%% = %%atom%%;
    export default %%atomIdentifier%%
`);

export default function debugLabelPlugin({ types: t }: typeof babel, options?: PluginOptions): PluginObj {
  return {
    visitor: {
      ExportDefaultDeclaration(
        nodePath: babel.NodePath<babel.types.ExportDefaultDeclaration>,
        state: babel.PluginPass,
      ) {
        const { node } = nodePath;
        if (t.isCallExpression(node.declaration) && isAtom(t, node.declaration.callee, options?.customAtomNames)) {
          const filename = (
            state.filename?.replace(options?.projectRoot ?? '', '') ?? 'unknownDefaultExportAtom'
          ).replace(/\.\w+$/, '');

          let displayName = filename.substring(filename.lastIndexOf('/') + 1);

          // ./{module name}/index.js
          if (displayName === 'index') {
            const name = filename.slice(0, -'/index'.length);
            displayName = name.substring(name.lastIndexOf('/') + 1);
          }
          // Relies on visiting the variable declaration to add the debugLabel

          const ast = buildExport({
            atomIdentifier: t.identifier(displayName),
            atom: node.declaration,
          });
          nodePath.replaceWithMultiple(ast as babel.Node[]);
        }
      },
      VariableDeclarator(path: babel.NodePath<babel.types.VariableDeclarator>) {
        if (
          t.isIdentifier(path.node.id) &&
          t.isCallExpression(path.node.init) &&
          isAtom(t, path.node.init.callee, options?.customAtomNames)
        ) {
          // computed/command 执行函数具名化
          const callee = path.node.init.callee;
          const varName = path.node.id.name;
          const firstArg = path.node.init.arguments[0];
          // computed/command 的第一个参数是匿名函数时，替换为具名函数
          if (
            (t.isIdentifier(callee) && (callee.name === 'computed' || callee.name === 'command')) ||
            (t.isMemberExpression(callee) &&
              t.isIdentifier(callee.property) &&
              (callee.property.name === 'computed' || callee.property.name === 'command'))
          ) {
            if (t.isArrowFunctionExpression(firstArg) || (t.isFunctionExpression(firstArg) && !firstArg.id)) {
              // 检查箭头函数体内是否有 this
              let containsThis = false;
              if (t.isArrowFunctionExpression(firstArg)) {
                // 用简单遍历检查 this
                const checkThis = (node: babel.types.Node) => {
                  if (t.isThisExpression(node)) {
                    containsThis = true;
                  }
                };
                // 递归遍历 body
                const traverse = (node: babel.types.Node) => {
                  checkThis(node);
                  for (const key in node) {
                    if (Object.prototype.hasOwnProperty.call(node, key)) {
                      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
                      const value = (node as any)[key];
                      if (Array.isArray(value)) {
                        value.forEach(traverse);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                      } else if (value && typeof value.type === 'string') {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        traverse(value);
                      }
                    }
                  }
                };
                traverse(firstArg.body);
              }
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (containsThis) {
                // Do not transform if 'this' is present in the function body
              } else {
                let funcPrefix = '__ccs_cmpt_';
                if (t.isIdentifier(callee) && callee.name === 'command') {
                  funcPrefix = '__ccs_cmd_';
                }

                const funcId = t.identifier(`${funcPrefix}${varName}`);
                const funcExpr = t.functionExpression(
                  funcId,
                  firstArg.params,
                  t.isBlockStatement(firstArg.body)
                    ? firstArg.body
                    : t.blockStatement([t.returnStatement(firstArg.body)]),
                  false,
                  firstArg.async,
                );
                path.node.init.arguments[0] = funcExpr;
              }
            }
          }

          const debugLabel = t.objectProperty(t.identifier('debugLabel'), t.stringLiteral(varName));

          if (path.node.init.arguments.length === 1) {
            path.node.init.arguments.push(t.objectExpression([debugLabel]));
          } else if (path.node.init.arguments.length > 1) {
            const existingOptions = path.node.init.arguments[1];
            if (t.isObjectExpression(existingOptions)) {
              const hasDebugLabel = existingOptions.properties.some(
                (prop: babel.types.ObjectMethod | babel.types.ObjectProperty | babel.types.SpreadElement) =>
                  t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'debugLabel',
              );
              if (hasDebugLabel) return;
              existingOptions.properties.push(debugLabel);
            }
          }
        }
      },
    },
  };
}
