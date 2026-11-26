// thecla-theme's session values.
declare module 'claude-code' {
  interface PluginState {
    'thecla-theme': {
      // True while the session waits on the person: a permission prompt, a
      // question, or a form; the desktop edge then runs fastest.
      isAsking: boolean
    }
  }
}
