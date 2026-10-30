# Course learning experience

Purchased course routes and `/home/preview/library/demo-course-*` use the same
`CourseExperienceClient`, `CoursePdpLayout`, `CourseLessonPlayer` and curriculum.
The demo never persists course progress to an account.

## Existing data contract

- `catalog_items.metadata` is JSONB. Lessons use `metadata.videos` in stored
  order, with `url` and optional `title`.
- Course summary uses `metadata.attributes.duration`, `level` and `language`.
- Instructor/author uses the existing `item_specs` resolver. Description,
  specification groups and legacy `metadata.specs` use `PdpProductDetails`.
- Progress uses `entitlements.metadata.course_progress.lastIndex` and
  `completedIndexes` via the existing authorized Server Action.

A read-only check of the configured database on 2026-10-30 found no catalog rows
with `digital_subtype = 'course'`. Demo editorial content is therefore fictional,
not copied course data. Its learning goals, practice project and media credit
demonstrate the existing specification contract. No database migration is needed.

## UX and safety

The purchased screen prioritizes the lesson over the marketing title, with a
responsive native player, previous/next navigation, ordered curriculum,
explicit completion toggle, accessible progress and a desktop focus mode. Focus
mode does not hide mobile navigation. Videos are not autoplayed or marked complete
merely by opening them; completion remains an explicit learner action.

Progress updates are normalized to the lesson count, support uncompletion and
are serialized; pending changes coalesce to the latest learner intent. Failed
saves preserve the local state and show Retry rather than claiming success.
Demo progress remains memory-local and resets on reload. This does not add
cross-tab or cross-device conflict resolution to the existing backend writer.

HTTPS media is validated before rendering. YouTube/Vimeo host matching is exact;
unavailable or invalid media shows a recoverable message without blocking lesson
navigation. Native media uses inline playback and metadata preload. External embeds
still require the existing deployment CSP; this change does not loosen it.

Only stored metadata is displayed. The UI does not fabricate modules, per-lesson
durations, instructor credentials, subtitles, certificates or graded assessments.

## Validation

```bash
npm test -- --runInBand __tests__/commerce/course-lesson-player.test.tsx __tests__/commerce/course-progress-state.test.ts __tests__/commerce/course-experience-progress.test.tsx __tests__/commerce/demo-library-preview.test.tsx
```