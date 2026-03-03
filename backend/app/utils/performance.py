import os
import time

import psutil


class PerformanceMonitor:
    def __init__(self):
        self.process = psutil.Process(os.getpid())
        self._start_time: float = 0.0
        self._start_memory: int = 0

    def start(self) -> None:
        self._start_time = time.perf_counter()
        self._start_memory = self.process.memory_info().rss

    def stop(self, traversed_nodes: int, extracted_nodes: int) -> dict:
        runtime_seconds = time.perf_counter() - self._start_time
        end_memory = self.process.memory_info().rss

        memory_usage_mb = max(end_memory - self._start_memory, 0) / (1024 * 1024)
        efficiency_ratio = extracted_nodes / traversed_nodes if traversed_nodes else 0.0

        return {
            "runtime_seconds": round(runtime_seconds, 4),
            "memory_usage_mb": round(memory_usage_mb, 4),
            "traversed_nodes": traversed_nodes,
            "extracted_nodes": extracted_nodes,
            "efficiency_ratio": round(efficiency_ratio, 6),
            "complexity_note": "Empirical proxy of T(n)=c1*n + c2*m using traversal and extraction counts.",
        }
