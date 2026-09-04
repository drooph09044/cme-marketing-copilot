from __future__ import annotations

from app.qa.schemas import Finding
from app.qa.static_checks import run_static_checks


def _journey(nodes):
    return {"useCaseId": "test", "journey": {"nodes": nodes}, "touchpoints": []}


def test_passes_on_minimal_valid_journey():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert all(isinstance(f, Finding) for f in findings)
    # Minimal valid journey should produce no `err` findings.
    assert not any(f.severity == "err" for f in findings)


def test_flags_missing_exit():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "err" and "EXIT" in f.message for f in findings)


def test_flags_missing_entry():
    j = _journey([
        {"id": "n2", "type": "MESSAGE", "tpId": "TP1"},
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "err" and "ENTRY" in f.message for f in findings)


def test_flags_message_without_tpid():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n2", "type": "MESSAGE"},  # missing tpId
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "warn" and "tpId" in f.message for f in findings)


def test_flags_duplicate_node_ids():
    j = _journey([
        {"id": "n1", "type": "ENTRY"},
        {"id": "n1", "type": "MESSAGE", "tpId": "TP1"},
        {"id": "n3", "type": "EXIT"},
    ])
    findings = run_static_checks(j)
    assert any(f.severity == "err" and "duplicate" in f.message.lower() for f in findings)


def test_flags_touchpoint_referenced_but_not_defined():
    j = {
        "useCaseId": "test",
        "journey": {"nodes": [
            {"id": "n1", "type": "ENTRY"},
            {"id": "n2", "type": "MESSAGE", "tpId": "TP_MISSING"},
            {"id": "n3", "type": "EXIT"},
        ]},
        "touchpoints": [{"tpId": "TP1"}],
    }
    findings = run_static_checks(j)
    assert any("TP_MISSING" in f.message for f in findings)
