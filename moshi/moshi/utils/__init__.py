# Copyright (c) Kyutai, all rights reserved.
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.

# Copyright (c) Meta Platforms, Inc. and affiliates.
# All rights reserved.
#
# This source code is licensed under the license found in the
# LICENSE file in the root directory of this source tree.
"""Utilities.

Utility helpers for embeddings and other small tools.
"""

from .embeddings import average_embeddings, cache_for_shortest_embedding

__all__ = ["average_embeddings", "cache_for_shortest_embedding"]
