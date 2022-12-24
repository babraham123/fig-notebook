export interface ResolvedImport {
  resolvedURL: string;
  /**
   * If this is true, it points to another notebook.
   */
  isInternal: boolean;
}

export function resolveImport(
  moduleName: string,
  internalModuleNames: Set<string>
): ResolvedImport {
  if (internalModuleNames.has(moduleName)) {
    return {
      resolvedURL: moduleName,
      isInternal: true,
    };
  }

  if (moduleName.startsWith('https://')) {
    return {
      resolvedURL: moduleName,
      isInternal: false,
    };
  }

  /**
   * Skypack imports! This allows for the NPM module 'magic.'
   */
  return {
    resolvedURL: `https://cdn.skypack.dev/${moduleName}`,
    isInternal: false,
  };
}
