"""Learning primitive -- router policies, reward functions, learning."""

from __future__ import annotations

from importlib import import_module
from typing import Any

from openjarvis.learning._stubs import (
    QueryAnalyzer,
    RewardFunction,
    RouterPolicy,
    RoutingContext,
)

_LAZY_EXPORTS = {
    "AgentConfigEvolver": "openjarvis.learning.agents.agent_evolver",
    "LearningOrchestrator": "openjarvis.learning.learning_orchestrator",
    "LLMOptimizer": "openjarvis.learning.optimize.llm_optimizer",
    "OptimizationEngine": "openjarvis.learning.optimize.optimizer",
    "OptimizationStore": "openjarvis.learning.optimize.store",
    "ComplexityQueryAnalyzer": "openjarvis.learning.routing.complexity",
    "score_complexity": "openjarvis.learning.routing.complexity",
    "HeuristicRewardFunction": "openjarvis.learning.routing.heuristic_reward",
    "HeuristicRouter": "openjarvis.learning.routing.router",
    "build_routing_context": "openjarvis.learning.routing.router",
    "TrainingDataMiner": "openjarvis.learning.training.data",
    "HAS_TORCH": "openjarvis.learning.training.lora",
    "LoRATrainer": "openjarvis.learning.training.lora",
    "LoRATrainingConfig": "openjarvis.learning.training.lora",
}


def __getattr__(name: str) -> Any:
    """Load heavier learning components only when explicitly requested."""
    module_name = _LAZY_EXPORTS.get(name)
    if module_name is None:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    value = getattr(import_module(module_name), name)
    globals()[name] = value
    return value


def ensure_registered() -> None:
    """Ensure all learning policies are registered in RouterPolicyRegistry."""
    from openjarvis.learning.routing.heuristic_policy import (
        ensure_registered as _reg_heuristic,
    )

    _reg_heuristic()

    from openjarvis.learning.routing.learned_router import (
        ensure_registered as _reg_learned,
    )

    _reg_learned()

    # Intelligence training (optional deps)
    try:
        import openjarvis.learning.intelligence  # noqa: F401
    except ImportError:
        pass

    # Orchestrator-specific training (optional deps)
    try:
        import openjarvis.learning.intelligence.orchestrator  # noqa: F401
    except ImportError:
        pass

    # Agent optimizers (optional deps)
    try:
        import openjarvis.learning.agents.dspy_optimizer  # noqa: F401
    except ImportError:
        pass
    try:
        import openjarvis.learning.agents.gepa_optimizer  # noqa: F401
    except ImportError:
        pass
    try:
        import openjarvis.learning.agents.ace_optimizer  # noqa: F401
    except ImportError:
        pass


__all__ = [
    "AgentConfigEvolver",
    "ComplexityQueryAnalyzer",
    "HAS_TORCH",
    "HeuristicRewardFunction",
    "HeuristicRouter",
    "LLMOptimizer",
    "LearningOrchestrator",
    "LoRATrainer",
    "LoRATrainingConfig",
    "OptimizationEngine",
    "OptimizationStore",
    "QueryAnalyzer",
    "RewardFunction",
    "RouterPolicy",
    "RoutingContext",
    "TrainingDataMiner",
    "build_routing_context",
    "ensure_registered",
    "score_complexity",
]
