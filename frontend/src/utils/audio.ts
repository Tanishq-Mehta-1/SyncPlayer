/** Wraps audio data in a Blob and returns an object URL for it. */
export function createAudioURL(parts: BlobPart[]): string {
    const blob = new Blob(parts, { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    console.log('Generated audio URL: ', url);
    return url;
}
