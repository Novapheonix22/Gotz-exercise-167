// Site-wide settings shown on the disclaimer page.
export const SITE_NAME = 'Spellcraft';

/** Contact for rights holders. Leave empty to hide the line. Set VITE_CONTACT_EMAIL in Vercel. */
export const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? '';

/** Bump this when the disclaimer text changes so everyone sees it again. */
export const DISCLAIMER_VERSION = '1';
