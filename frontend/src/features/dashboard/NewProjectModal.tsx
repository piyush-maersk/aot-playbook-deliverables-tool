import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../api/client";
import { Button, Field, Modal, Select, TextInput } from "../../components/ui";
import { PROJECT_STATUSES, type ProjectStatus } from "../../domain/types";

export function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Planning");
  const [customerName, setCustomerName] = useState("");
  const [fbmId, setFbmId] = useState("");
  const [region, setRegion] = useState("");
  const [location, setLocation] = useState("");
  const [seed, setSeed] = useState(true);

  const create = useMutation({
    mutationFn: () => api<{ id: string }>("/projects", {
      method: "POST",
      body: { name: name.trim(), status, seedMilestonePlan: seed, projectDetails: { customerName, fbmId, region, location } },
    }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["projects"] });
      await qc.invalidateQueries({ queryKey: ["reports"] });
      onCreated(r.id);
    },
  });

  return (
    <Modal title="New project" onClose={onClose} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>{create.isPending ? "Creating…" : "Create project"}</Button>
      </>
    }>
      <div className="grid cols-2">
        <Field label="Project name *" hint="e.g. ON Running – Noda DC" className="span-2">
          <TextInput value={name} onChange={setName} autoFocus />
        </Field>
        <Field label="Lifecycle status">
          <Select value={status} onChange={setStatus} options={PROJECT_STATUSES} />
        </Field>
        <Field label="Customer Name" hint="Customer / brand name"><TextInput value={customerName} onChange={setCustomerName} /></Field>
        <Field label="FbM ID" hint="Project FbM ID, e.g. 4661"><TextInput value={fbmId} onChange={setFbmId} /></Field>
        <Field label="Region" hint="Maersk region, e.g. APA, EUR, NAM"><TextInput value={region} onChange={setRegion} /></Field>
        <Field label="Location" hint="City, Country"><TextInput value={location} onChange={setLocation} /></Field>
      </div>
      <label className="check mt">
        <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} />
        Start the Milestone Plan from the AOT Milestone Plan template (MS0 – MS6 activities)
      </label>
      <p className="muted mt" style={{ fontSize: "0.85rem" }}>All other project details can be typed in or extracted from uploaded documents after the project is created.</p>
      {create.error && <div className="banner error">{(create.error as Error).message}</div>}
    </Modal>
  );
}
