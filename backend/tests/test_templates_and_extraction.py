from __future__ import annotations

import io

import docx
import openpyxl
import pytest

from app.template_library import work_package_library

from .conftest import KNOWLEDGEBASE


def test_library_contains_all_templates_with_master_prompt_corrections():
    lib = work_package_library()
    codes = [t["code"] for t in lib["templates"]]
    assert codes == ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"]
    t1 = lib["templates"][0]
    assert "delivery decisions and are defined" in t1["scope"]["clarifications"]
    t7 = next(t for t in lib["templates"] if t["code"] == "T7")
    tr07 = next(r for r in t7["technicalRequirements"] if r["id"] == "TR-07")
    assert tr07["text"].startswith("Automation machines shall support the operational process flow")
    assert next(r for r in t7["technicalRequirements"] if r["id"] == "TR-08")["text"].endswith("(See Appendix H.)")
    assert [d["milestoneKey"] for d in lib["deliverables"]] == ["MS1.3", "MS2", "MS3", "MS4", "MS5", "MS6"]
    assert len(lib["canonicalAppendix"]) == 10


def _upload(client, pid, name, data, role):
    return client.post(f"/projects/{pid}/documents", data={"role": role},
                       files={"file": (name, data, "application/octet-stream")})


def test_estimation_workbook_maps_b6_rules_and_bom(client, project):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Request Type", "New Site | On Running"])
    ws.append(["Region", "APA"])
    ws.append(["FbM ID", 4661])
    ws.append(["City", "Noda"])
    ws.append(["Country", "Japan"])
    ws.append(["Location Size", 32060])
    ws.append(["Operation Type", "Warehouse (MCL)"])
    ws.append(["Total Cost", 125000])
    ws.append([])
    ws.append(["Description", "Quantity", "Comments", "Unit Price"])
    ws.append(["Packing Station"])
    ws.append(["Desktop Computer", 5, "- HP Elite 800", 900])
    ws.append(["Installation services", 1, "", 4000])
    ws.append(["RFID Table Pad", 0, "", 300])
    buf = io.BytesIO()
    wb.save(buf)

    r = _upload(client, project["project"]["id"], "Estimation.xlsx", buf.getvalue(), "Estimation")
    assert r.status_code == 201, r.text
    ex = r.json()["extraction"]
    got = {s["field"]: s["value"] for s in ex["suggestions"]}
    assert got["projectDetails.customerName"] == "On Running"
    assert got["projectDetails.region"] == "APA"
    assert got["projectDetails.fbmId"] == "4661"
    assert got["projectDetails.location"] == "Noda, Japan"
    assert got["projectDetails.warehouseArea"] == "32,060 sqm"
    assert got["projectDetails.operationType"] == "Warehouse"
    assert got["projectDetails.product"] == "MCL"
    assert all("125000" not in s["value"] for s in ex["suggestions"])        # R6: never extract costs
    assert ex["bom"] == [{"category": "Packing Station", "hardwareName": "Desktop Computer",
                          "model": "HP Elite 800", "quantity": "5", "source": "Estimation.xlsx (Sheet)"}]


def test_docx_overview_grid_pairs_labels_with_values(client, project):
    d = docx.Document()
    t = d.add_table(rows=3, cols=6)
    for i, v in enumerate(["Customer Name", "Amazon", "Region", "EUR", "Site Address", ""]):
        t.rows[0].cells[i].text = v
    for i, v in enumerate(["WMS", "Customer", "WCS", "Customer", "Other App", ""]):
        t.rows[1].cells[i].text = v
    for i, v in enumerate(["Warehouse area", "1.3 sqm", "Contract length", "-", "Product", "MCL"]):
        t.rows[2].cells[i].text = v
    d.add_paragraph("Go Live: 01/07/2026")
    buf = io.BytesIO()
    d.save(buf)
    ex = _upload(client, project["project"]["id"], "BRD.docx", buf.getvalue(), "BRD").json()["extraction"]
    got = {(s["field"], s["value"]) for s in ex["suggestions"]}
    assert ("projectDetails.customerName", "Amazon") in got
    assert ("projectDetails.wms", "Customer") in got
    assert ("projectDetails.customerName", "WCS") not in got
    assert ("projectDetails.warehouseArea", "1.3 sqm") in got          # values with units kept verbatim
    assert not any(f == "projectDetails.contractLength" for f, _ in got)  # "-" placeholder ignored
    assert ("businessMilestones.gld", "2026-07-01") in got


@pytest.mark.skipif(not (KNOWLEDGEBASE / "PAGE 1 - Project Overview.docx").exists(), reason="Knowledgebase missing")
def test_page1_template_is_readable(client, project):
    data = (KNOWLEDGEBASE / "PAGE 1 - Project Overview.docx").read_bytes()
    ex = _upload(client, project["project"]["id"], "PAGE 1.docx", data, "Other").json()["extraction"]
    got = {s["field"]: s["value"] for s in ex["suggestions"]}
    assert got.get("projectDetails.fbmId") == "4715"
    assert got.get("projectDetails.siteId") == "DE0003C"


def test_rejects_disallowed_file_types(client, project):
    assert _upload(client, project["project"]["id"], "x.exe", b"MZ", "Other").status_code == 400
