// Custom properties cross the shadow boundary, so the site themes the block from its own CSS.
export const RECOMMENDATIONS_STYLES = `
:host { display: block; font-family: var(--pw-reco-font, inherit); }
.title { margin: 0 0 12px; font-size: 1.25em; font-weight: 600; }
.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(var(--pw-reco-columns, auto-fill), minmax(140px, 1fr));
}
@media (max-width: 600px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
}
.card { display: flex; flex-direction: column; gap: 6px; color: inherit; text-decoration: none; }
.image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--pw-reco-radius, 8px);
  background: rgba(0, 0, 0, 0.04);
}
.name { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.price { color: var(--pw-reco-accent, currentColor); font-weight: 600; }
.old { margin-left: 6px; font-weight: 400; text-decoration: line-through; opacity: 0.6; }
`;
