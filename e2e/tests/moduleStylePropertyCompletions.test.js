const path = require('path')
const createServer = require('../server-fixture')
const { openMockFile, getFirstResponseOfType } = require('./helpers');
const typescript = require('typescript')

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('ModuleStyle Property Completions', () => {
  it('should return details for classNames completion', () => {
    const server = createServer();
    const code = [
      '// comment',
      `import {useModuleStyle} from 'style-hook'`,
      'const styles = useModuleStyle`.a{}`',
      'styles.',
    ].join('\n')
    openMockFile(server, mockFileName, code);
    const command = 'completions'
    server.sendCommand(command, { file: mockFileName, offset: 8, line: 4 });
    return server.close().then(() => {
      const completionsResponse = getFirstResponseOfType(command, server);
      expect(completionsResponse.success).toBeTruthy()
      expect(completionsResponse.body).toHaveLength(1)
      expect(completionsResponse.body[0].name).toBe('a')
    });
  });
});

describe('issue', () => {
  it('#3', () => {
    const server = createServer();
    const code = [
      `import React from 'react'`,
      `import { createModuleStyle } from 'style-hook'`,
      'const styles = createModuleStyle `.logo {}`',
      'const JSX = <img className={styles.logo} />',
    ].join('\n')
    openMockFile(server, mockFileName, code);
    const command = 'completions'
    server.sendCommand(command, { file: mockFileName, offset: 41, line: 4 });
    return server.close().then(() => {
      const completionsResponse = getFirstResponseOfType(command, server);
      expect(completionsResponse.success).toBeTruthy()
      expect(completionsResponse.body).not.toHaveLength(0)
      expect(completionsResponse.body[0].kind).toBe(typescript.ScriptElementKind.jsxAttribute)
    })
  })
})
