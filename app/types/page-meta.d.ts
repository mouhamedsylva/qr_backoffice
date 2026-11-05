declare module '#app' {
  interface PageMeta {
    /** Page accessible sans être connecté (connexion, inscription…). */
    public?: boolean;
    /** Page publique qui reste accessible une fois connecté (ex. invitation). */
    allowAuthenticated?: boolean;
  }
}
export {};
