declare module 'electron-installer-debian' {
  interface DebianOptions {
    src: string
    dest: string
    arch?: string
    name?: string
    productName?: string
    genericName?: string
    description?: string
    productDescription?: string
    version?: string
    revision?: string
    section?: string
    priority?: string
    depends?: string[]
    recommends?: string[]
    suggests?: string[]
    enhances?: string[]
    preDepends?: string[]
    maintainer?: string
    homepage?: string
    bin?: string
    icon?: string | Record<string, string>
    categories?: string[]
    mimeType?: string[]
    lintianOverrides?: string[]
    scripts?: {
      preinst?: string
      postinst?: string
      prerm?: string
      postrm?: string
    }
    desktopTemplate?: string
    compression?: string
  }

  function installer(options: DebianOptions): Promise<void>
  export default installer
}
