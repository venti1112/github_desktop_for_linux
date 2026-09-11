declare module 'electron-installer-redhat' {
  interface RedhatOptions {
    src: string
    dest: string
    arch?: string
    platform?: string
    name?: string
    productName?: string
    genericName?: string
    description?: string
    productDescription?: string
    version?: string
    revision?: string
    license?: string
    requires?: string[]
    homepage?: string
    compressionLevel?: number
    bin?: string
    execArguments?: string[]
    icon?: string | Record<string, string>
    categories?: string[]
    mimeType?: string[]
    scripts?: {
      pre?: string
      post?: string
      preun?: string
      postun?: string
    }
    desktopTemplate?: string
    specTemplate?: string
  }

  function installer(options: RedhatOptions): Promise<void>
  export default installer
}
