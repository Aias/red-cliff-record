/**
 * Apply seriation to records based on their embeddings.
 * Orders records starting with the first (most similar to query),
 * then each subsequent record is chosen based on similarity to the previous.
 */
export function seriateRecordsByEmbedding<
  T extends { textEmbedding: number[] | null; similarity?: number },
>(records: T[]): T[] {
  if (records.length <= 1) return records;

  const seriated: T[] = [];
  const remaining = [...records];

  // Start with the first record (already sorted by similarity in the query)
  const first = remaining.shift();
  if (!first) return records;
  seriated.push(first);

  // Build the seriated sequence
  while (remaining.length > 0) {
    const lastRecord = seriated[seriated.length - 1];
    const lastEmbedding = lastRecord?.textEmbedding;
    if (!lastEmbedding) break;

    // Find the record most similar to the last one in the sequence
    let bestIndex = -1;
    let bestSimilarity = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidateEmbedding = remaining[i]?.textEmbedding;
      if (!candidateEmbedding) continue;

      // Calculate cosine similarity between embeddings
      const similarity = cosineSimilarity(lastEmbedding, candidateEmbedding);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = i;
      }
    }

    // If we found a match, move it to the seriated list
    if (bestIndex >= 0) {
      const nextRecord = remaining.splice(bestIndex, 1)[0];
      if (nextRecord) seriated.push(nextRecord);
    } else {
      // No more records with embeddings, exit the loop
      break;
    }
  }

  // Add any remaining records that couldn't be seriated (no embeddings)
  seriated.push(...remaining);

  return seriated;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal !== undefined && bVal !== undefined) {
      dotProduct += aVal * bVal;
      magnitudeA += aVal * aVal;
      magnitudeB += bVal * bVal;
    }
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
