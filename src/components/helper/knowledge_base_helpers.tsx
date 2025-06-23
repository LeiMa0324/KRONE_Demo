//Cosine Similarity calculation function
function cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
}

//Approximate search for top k closest using cosine similarity
export function approximateSearch(embeddings_array: number[][], embedding: number[], k: number): { index: number, similarity: number }[] {
    const similarities = embeddings_array.map((vector, index) => ({
        index,
        similarity: cosineSimilarity(vector, embedding),
    }));

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top k
    return similarities.slice(0, k);
}