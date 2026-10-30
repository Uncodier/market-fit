// Uses the existing catalog JSONB contract; all editorial content is fictional.
export const demoCourseMetadata = {
  attributes: { duration: 'Self-paced', level: 'Beginner', language: 'English' },
  videos: [
    { title: 'Welcome to product design', url: '/course-resources/sample-flower.mp4' },
    { title: 'Understand the problem before the solution', url: '/course-resources/sample-flower.mp4' },
    { title: 'Turn observations into opportunities', url: '/course-resources/sample-flower.mp4' },
    { title: 'Explore ideas with low-fidelity prototypes', url: '/course-resources/sample-flower.mp4' },
    { title: 'Test, learn, and iterate', url: '/course-resources/sample-flower.mp4' },
    { title: 'Your next steps as a product designer', url: '/course-resources/sample-flower.mp4' },
  ],
  specs: [
    { label: 'Learning goal', value: 'Build a repeatable process: discover a problem, explore solutions, and validate your ideas.' },
    { label: 'Practice project', value: 'Choose an everyday experience. Write a problem statement, sketch three alternatives, and plan a usability test.' },
    { label: 'Video credits', value: 'Every demo lesson uses the same short CC0 flower clip from MDN’s interactive examples. This is sample playback footage, not an instructional recording.' },
  ],
}