declare module '@joplin/turndown-plugin-gfm' {
  import type TurndownService from 'turndown';
  export const gfm: TurndownService.Plugin;
}

declare module '@mixmark-io/domino' {
  const domino: {
    createDocument(html: string, force?: boolean): Document;
    impl: { Element: typeof Element; Node: typeof Node; Text: typeof Text };
  };
  export default domino;
}
