const path = require('path')
const createServer = require('../server-fixture')
const { openMockFile, getFirstResponseOfType } = require('./helpers');

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'main.ts');

describe('ModuleStyle Property Completions', () => {
  it('should return details for classNames completion', () => {
    const server = createServer();
    const code = [
      `import {useModuleStyle} from 'style-hook'`,
      'const styles = useModuleStyle`.a{}`',
      'styles.',
    ].join('\n')
    openMockFile(server, mockFileName, code);
    const command = 'completions'
    server.sendCommand(command, { file: mockFileName, offset: 8, line: 3 });
    return server.close().then(() => {
      const completionsResponse = getFirstResponseOfType(command, server);
      expect(completionsResponse.success).toBeTruthy()
      expect(completionsResponse.body).toHaveLength(1)
      expect(completionsResponse.body[0].name).toBe('a')
    });
  });
});
