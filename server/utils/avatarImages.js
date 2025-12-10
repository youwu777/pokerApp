// Available avatar images in client/src/image folder
export const AVATAR_IMAGES = [
    '133885.png',
    '265707.png',
    '276386.png',
    '288593.png',
    '81865.png',
    '87535.png',
    '88075.png',
    '88249.png',
    '89041.png',
    '89137.png',
    '89311.png',
    '89419.png',
    'image.png',
    'koala-bear-animal-face-icon.jpg',
    'nailong.png'
];

/**
 * Get a random avatar image filename
 */
export function getRandomAvatar() {
    const randomIndex = Math.floor(Math.random() * AVATAR_IMAGES.length);
    return AVATAR_IMAGES[randomIndex];
}
