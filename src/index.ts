// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import * as ts from 'typescript/lib/tsserverlibrary';
import { StyledPlugin } from 'typescript-styled-plugin/lib/_plugin'

export = (mod: { typescript: typeof ts }) => {
  const styledPlugin = new StyledPlugin(mod.typescript)
  return {
    create(info: ts.server.PluginCreateInfo) {
      info.config.tags = ['useStyle', 'useGlobalStyle', 'useModuleStyle', 'css', 'createModuleStyle']
      inject(mod.typescript, info)
      return styledPlugin.create(info)
    }
  }
}
// ({ create: (info: ts.server.PluginCreateInfo) => create(mod.typescript, info) })
// new StylePlugin(mod.typescript);


function inject(typescript: typeof ts, info: ts.server.PluginCreateInfo): void {
  const { languageService, languageServiceHost } = info

  function getSourceCode(fileName: string) {
    return languageService.getProgram()?.getSourceFile(fileName)?.getFullText()
  }

  const targetApiNames = ['createModuleStyle', 'useModuleStyle']
  const TARGET_INTERFACE = 'CSSModule'


  const getCompletionsAtPosition = languageService.getCompletionsAtPosition.bind(languageService)
  const getDefinitionAtPosition = languageService.getDefinitionAtPosition.bind(languageService)
  const getDefinitionAndBoundSpan = languageService.getDefinitionAndBoundSpan.bind(languageService)

  const log = (text: any) => {
    if (typeof text === 'object')
      text = '\n' + JSON.stringify(text, null, 2)
    languageServiceHost.log?.('[style-hook-plugin]' + text)
  }

  function isStyleTemplate(fileName: string, position: number): boolean {
    const definition = getDefinitionAtPosition(fileName, position)?.[0]
    if (!definition) return false
    const {ScriptElementKind} = typescript
    if (definition.kind === ScriptElementKind.functionElement && targetApiNames.includes(definition.name))
      return true
    return false
  }

  function getModuleStyleDefinition(fileName: string, position: number): ts.DefinitionInfo | undefined {
    const definition = getDefinitionAtPosition(fileName, position)?.[0]
    if (!definition) return
    const sourceCode = getSourceCode(definition.fileName)
    if (!sourceCode) return
    const {ScriptElementKind} = typescript
    const {textSpan} = definition
    if (!textSpan) return
    if ([ScriptElementKind.constElement, ScriptElementKind.variableElement, ScriptElementKind.letElement].includes(definition.kind)) {
      let position = sourceCode.indexOf('=', textSpan.start + textSpan.length)
      if (position === -1) return
      position ++
      position += sourceCode.slice(position).length - sourceCode.slice(position).trim().length
      if (isStyleTemplate(definition.fileName, position))
        return definition
      return getModuleStyleDefinition(definition.fileName, position)
    }
    // if (definition.kind === ScriptElementKind.memberVariableElement) {
    //   let position = sourceCode.indexOf(':', textSpan.start + textSpan.length)
    //   if (position === -1) return
    //   position ++
    //   position += sourceCode.slice(position).length - sourceCode.slice(position).trim().length
    //   if (isStyleTemplate(definition.fileName, position))
    //     return definition
    //   return getStyleTagDefinition(definition.fileName, position)
    // }
  }

  function getModuleStyleSpan(definition: ts.DefinitionInfo): ts.TextSpan | undefined {
    const {contextSpan} = definition
    if (!contextSpan) return
    const sourceCode = getSourceCode(definition.fileName)
    if (!sourceCode) return
    const startPos = sourceCode.indexOf('`', contextSpan.start) + 1
    const endPos = sourceCode.lastIndexOf('`', contextSpan.start + contextSpan.length)
    return {
      start: startPos,
      length: endPos - startPos
    }
  }

  function getModuleStyleCode(definition: ts.DefinitionInfo): string | undefined {
    const textSpan = getModuleStyleSpan(definition)
    if (!textSpan) return
    const sourceCode = getSourceCode(definition.fileName)
    return sourceCode?.slice(textSpan.start, textSpan.start + textSpan.length)
  }

  function getModuleStyleClassNames(definition: ts.DefinitionInfo): string[] | undefined {
    const templateCode = getModuleStyleCode(definition)
    const match = templateCode?.match(/(?<=\.)[a-zA-Z_][-\w]*\b/g)
    if (!match) return
    return match
  }

  function findModuleStyleClassNames(definition: ts.DefinitionInfo, className: string): number {
    const textSpan = getModuleStyleSpan(definition)
    if (!textSpan) return -1
    const templateCode = getModuleStyleCode(definition)
    if (!templateCode) return -1
    const position =  templateCode.search(new RegExp(`\\.${className}\\s*\\{?`))
    if (position === -1) return -1
    return textSpan.start + position + 1
  }

  function getHosterPosition(fileName: string, position: number) {
    const sourceCode = getSourceCode(fileName)
    if (!sourceCode) return -1
    log(sourceCode)
    const visitorPosition = Math.max(
      sourceCode.lastIndexOf('.', position),
      sourceCode.lastIndexOf('[', position),
    )
    if (visitorPosition === -1) return -1
    const hosterPosition = sourceCode.slice(0, visitorPosition).trim().length
    return hosterPosition
  }


  languageService.getCompletionsAtPosition = function (fileName, position, options) {
    const completions = getCompletionsAtPosition(fileName, position, options)
    if (!completions?.isMemberCompletion) return completions
    const { ScriptElementKind } = typescript
    if (completions.entries[0]?.kind === ScriptElementKind.jsxAttribute) return completions
    const hostPosition = getHosterPosition(fileName, position)
    if (hostPosition === -1) return completions
    const hostTypeDefinition = languageService.getTypeDefinitionAtPosition(fileName, hostPosition)?.[0]
    if (!hostTypeDefinition) return completions
    if (!hostTypeDefinition.fileName.includes('style-hook') || hostTypeDefinition.name !== TARGET_INTERFACE)
      return completions
    const moduleStyleDefinition = getModuleStyleDefinition(fileName, hostPosition)
    if (!moduleStyleDefinition) return completions
    const classNames = getModuleStyleClassNames(moduleStyleDefinition)
    if (!classNames?.length) return completions
    completions.entries = classNames.map((className, i) => <ts.CompletionEntry>({
      kind: ScriptElementKind.memberVariableElement,
      name: className,
      sortText: String(i),
    }))
    return completions
  }

  languageService.getDefinitionAndBoundSpan = function (fileName: string, position: number) {
    const definitionInfoAndBoundSpan = getDefinitionAndBoundSpan(fileName, position)
    const definition = definitionInfoAndBoundSpan?.definitions?.[0]
    if (!definition) return
    if (!definition.fileName.includes('style-hook') || definition.containerName !== TARGET_INTERFACE)
      return definitionInfoAndBoundSpan

    const sourceCode = getSourceCode(fileName)
    if (!sourceCode) return definitionInfoAndBoundSpan
    const selection =  languageService.getSmartSelectionRange(fileName, position)
    if (!selection.parent) return definitionInfoAndBoundSpan
    const hostPosition = selection.parent.textSpan.start
    const moduleStyleDefinition = getModuleStyleDefinition(fileName, hostPosition)
      if (!moduleStyleDefinition) return definitionInfoAndBoundSpan
    getModuleStyleClassNames
    const word = sourceCode.slice(selection.textSpan.start, selection.textSpan.start + selection.textSpan.length)
    const classNamePosition = findModuleStyleClassNames(moduleStyleDefinition, word)
    if (classNamePosition === -1) return definitionInfoAndBoundSpan
    if (definitionInfoAndBoundSpan) definitionInfoAndBoundSpan.definitions = [{
        fileName: moduleStyleDefinition.fileName,
        name: word,
        textSpan: {
          start: classNamePosition,
          length: word.length,
        },
        kind: typescript.ScriptElementKind.string,
        containerKind: typescript.ScriptElementKind.string,
        containerName: TARGET_INTERFACE,
    }]
    return definitionInfoAndBoundSpan
  }
}
