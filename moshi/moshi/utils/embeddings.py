"""Embedding utilities.

Provides helpers to average a list of torch tensors containing embeddings.
"""
from typing import Any, List, Tuple
import torch


def average_embeddings(tensors: List[torch.Tensor], align: str = "truncate") -> torch.Tensor:
    """Average a list of embedding tensors along the time/sequence dimension.

    Args:
        tensors: list of torch.Tensor. Each tensor should have the same trailing
            shape (embedding dims) but may differ in the first (time) dimension.
        align: how to align sequences with different lengths. Only "truncate"
            is supported for now: all tensors are truncated to the shortest
            length before averaging.

    Returns:
        A torch.Tensor containing the averaged embeddings with shape
        [min_time, ...embedding_dims].

    Raises:
        ValueError: if tensors is empty or shapes are incompatible.
    """
    if not tensors:
        raise ValueError("tensors list is empty")

    # Ensure all tensors are torch tensors
    tensors = [torch.as_tensor(t) for t in tensors]

    # All tensors must have same number of dims and same trailing dims
    ref_shape = tensors[0].shape[1:]
    for t in tensors:
        if t.ndim < 1:
            raise ValueError("Each embedding tensor must have at least 1 dimension")
        if t.shape[1:] != ref_shape:
            raise ValueError("All tensors must share the same trailing dimensions")

    if align != "truncate":
        raise ValueError("Only 'truncate' align is supported")

    min_len = min(t.shape[0] for t in tensors)
    if min_len == 0:
        raise ValueError("Cannot average tensors with zero-length first dimension")

    truncated = [t[:min_len] for t in tensors]
    stacked = torch.stack(truncated, dim=0)
    # Average across the stacked 0-th dimension (across different examples)
    averaged = torch.mean(stacked, dim=0)
    return averaged


def cache_for_shortest_embedding(pairs: List[Any]) -> torch.Tensor:
    """Return the `cache` associated with the shortest embedding in `pairs`.

    Args:
        pairs: A list where each element is either:
            - a (embeddings, cache) tuple/list, or
            - a dict with keys "embeddings" and "cache".

    Returns:
        The `cache` tensor associated with the embedding that has the smallest
        length along its first (time) dimension.

    Raises:
        ValueError: if `pairs` is empty or no valid (embeddings, cache) pairs found.
    """
    if not pairs:
        raise ValueError("pairs list is empty")

    extracted: List[Tuple[torch.Tensor, torch.Tensor]] = []
    for item in pairs:
        if isinstance(item, dict):
            emb = item.get("embeddings")
            cache = item.get("cache")
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            emb, cache = item[0], item[1]
        else:
            continue

        if emb is None or cache is None:
            continue

        emb_t = torch.as_tensor(emb)
        extracted.append((emb_t, cache))

    if not extracted:
        raise ValueError("No valid (embeddings, cache) pairs found")

    # Find the index of the shortest embedding along dim 0
    lengths = [e.shape[0] for e, _ in extracted]
    min_idx = int(torch.argmin(torch.tensor(lengths)).item())
    return extracted[min_idx][1]
