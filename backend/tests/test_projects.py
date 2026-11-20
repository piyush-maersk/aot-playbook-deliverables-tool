from __future__ import annotations


def _save(client, doc, base, user=None):
    body = {"project": doc["project"], "artefacts": doc["artefacts"], "baseRevision": base}
    headers = {"X-Dev-User": user} if user else {}
    return client.put(f"/projects/{doc['project']['id']}", json=body, headers=headers)


def test_create_seeds_milestone_plan_and_summary(client, project):
    activities = project["artefacts"]["milestonePlan"]["activities"]
    assert activities and activities[0]["id"] == "MP-001"
    assert {a["milestone"] for a in activities} >= {"MS0", "MS1.1", "MS2", "MS6"}
    listed = next(p for p in client.get("/projects").json() if p["id"] == project["project"]["id"])
    assert listed["fbmId"] == "4661"
    assert listed["summary"]["milestonePlan"]["tasks"] > 0


def test_save_increments_revision_and_rejects_stale_base(client, project):
    project["artefacts"]["overview"]["projectDetails"]["customerName"] = "On Running"
    ok = _save(client, project, project["revision"])
    assert ok.status_code == 200 and ok.json()["revision"] == project["revision"] + 1

    stale = _save(client, project, project["revision"], user="someone.else@maersk.com")
    assert stale.status_code == 409
    assert stale.json()["revision"] == project["revision"] + 1

    fresh = client.get(f"/projects/{project['project']['id']}").json()
    assert fresh["artefacts"]["overview"]["projectDetails"]["customerName"] == "On Running"


def test_versions_merge_for_same_user_and_split_for_others(client, project):
    pid, rev = project["project"]["id"], project["revision"]
    rev = _save(client, project, rev).json()["revision"]
    rev = _save(client, project, rev).json()["revision"]          # same user < 10 min -> merged
    rev = _save(client, project, rev, user="other@maersk.com").json()["revision"]
    revisions = [v["revision"] for v in client.get(f"/projects/{pid}/versions").json()]
    assert revisions == [rev, rev - 1]


def test_work_package_fields_are_validated(client, project):
    project["artefacts"]["workPackages"] = [{
        "id": "WP-01", "templateCodes": ["T1"],
        "requirements": [{"key": "k1", "kind": "FR", "originalId": "FR-01", "text": "x", "action": "MAYBE"}],
    }]
    assert _save(client, project, project["revision"]).status_code == 422


def test_soft_delete_returns_410_on_save_and_hides_versions(client, project):
    pid = project["project"]["id"]
    assert client.delete(f"/projects/{pid}").status_code == 204
    assert _save(client, project, project["revision"]).status_code == 410
    assert client.get(f"/projects/{pid}").status_code == 404
    assert client.get(f"/projects/{pid}/versions").status_code == 404
    assert client.post(f"/projects/{pid}/restore").status_code == 200
    assert client.get(f"/projects/{pid}").status_code == 200


def test_non_creator_contributor_cannot_delete(client, project):
    pid = project["project"]["id"]
    assert client.delete(f"/projects/{pid}", headers={"X-Dev-User": "contrib@maersk.com"}).status_code == 403


def test_presence_lists_other_users(client, project):
    pid = project["project"]["id"]
    client.put(f"/projects/{pid}/presence", json={"mode": "editing"}, headers={"X-Dev-User": "a@maersk.com"})
    others = client.put(f"/projects/{pid}/presence", json={"mode": "viewing"}).json()["others"]
    assert [o["email"] for o in others] == ["a@maersk.com"]
    assert others[0]["mode"] == "editing"
