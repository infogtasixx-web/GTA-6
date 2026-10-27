# GTA SIXX Design Notes

## Product and audience

GTA SIXX is an independent English-language fan guide for readers tracking Grand Theft Auto VI. The homepage should answer the release-date question quickly, then lead into useful editorial guides and playable trailer previews.

## Visual direction

Use a restrained Vice City night palette: ink `#071012`, deep teal `#101A1E`, warm cream `#FFF9CB`, rose `#FFB2C6`, and lilac `#E5DDFF`. Keep the surfaces dark and the editorial sections in pastel blocks, with color used to distinguish sections and actions.

Use a system display stack (`Impact`, `Arial Narrow`, system UI) for bold game-guide headings and system UI for body text. Do not load remote web fonts; first paint and legible fallback matter more than matching a particular font file.

## Layout and behavior

The home page uses a direct hero, live timezone countdown, guide directory, news, trailer shelf, location/character summaries, and FAQ. The home page is static at load: no splash screen, long scroll-cinema scene, canvas particles, or continuously moving ticker. Keep hover/focus feedback short and preserve visible keyboard focus.

Trailer previews use local poster art and load the embedded player only after a visitor chooses Play. Do not add visible links that send visitors to an external publisher site. The player itself is hosted by the video publisher and necessarily requests that domain after Play.

Guide pages share the global shell and responsive layouts in `guide.css`. Keep current evidence limitations clear; fan-made or speculative material must not look like official game information.

## Accessibility and performance

Respect keyboard operation, meaningful button names, semantic headings, and reduced-motion preferences. Use local assets where practical, size media to its display box, and lazy-load below-the-fold images and video players. Avoid scroll-tied animation and work that runs every frame when a static composition communicates the same information.
