/* eslint-disable no-undef */
const path = require('path')
const createServer = require('../server-fixture')
const { openMockFile, getFirstResponseOfType } = require('./helpers')

const mockFileName = path.join(__dirname, '..', 'project-fixture', 'app.tsx')

describe('ModuleStyle property go to Definition', () => {
  it('should go to the style code className', () => {
    const server = createServer()
    const code = [
      `import {useModuleStyle} from 'style-hook'`,
      'const styles = useModuleStyle`.a{}`',
      'styles.a',
    ].join('\n')
    openMockFile(server, mockFileName, code)
    const command = 'definitionAndBoundSpan'
    server.sendCommand(command, { file: mockFileName, offset: 9, line: 3 })
    return server.close().then(() => {
      const completionsResponse = getFirstResponseOfType(command, server)
      expect(completionsResponse.success).toBeTruthy()
      expect(completionsResponse.body.definitions).toHaveLength(1)
      expect(completionsResponse.body.definitions[0].start).toEqual({ line: 2, offset: 32 })
      expect(completionsResponse.body.definitions[0].end).toEqual({ line: 2, offset: 33 })
    })
  })
})
