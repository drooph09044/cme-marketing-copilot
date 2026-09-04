import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
    applyPromptToJourneyDraft,
    buildJourneyRecord,
    buildProfileSimulation,
    buildRunAllSuitesResult,
    buildSingleTouchpointDraft,
    createDefaultDashboardState,
    createEdgeDraft,
    createNodeDraft,
    findJourneyBySlug,
    getBootstrapPayload,
    getJourneysByCategory,
    hydrateJourneyRecords,
    makeUniqueJourneySlug,
    nodeDetailsMapToArray,
    PRECONFIGURED_JOURNEYS,
    SEGMENT_LIBRARY,
} from "../../shared/suiteData";
import { BlueprintModule } from "../components/BlueprintModule";
import { JourneyConfigModule } from "../components/JourneyConfigModule";
import { QaModule } from "../components/QaModule";

const COPILOT_API = "/api/copilot";
const AJO_PREPARE_DELAY_MS = 3000;
const AJO_SUCCESS_CLOSE_DELAY_MS = 4200;
const AJO_ACTIVATE_MIN_DELAY_MS = 9000;
const ACTIVATION_SOURCE_SYSTEMS = new Set(["sports", "media", "telecom", "automotive"]);

function wait(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

function normalizeActivationSourceSystem(value, fallback = "sports") {
    const candidate = String(value ?? "")
        .trim()
        .toLowerCase();
    if (ACTIVATION_SOURCE_SYSTEMS.has(candidate)) {
        return candidate;
    }
    return ACTIVATION_SOURCE_SYSTEMS.has(fallback) ? fallback : "sports";
}

function readLiveActivationSourceSystem(fallback = "sports") {
    if (typeof window === "undefined") {
        return normalizeActivationSourceSystem(fallback);
    }

    try {
        const urlSourceSystem = new URLSearchParams(window.location.search).get("sourceSystem");
        if (urlSourceSystem) {
            return normalizeActivationSourceSystem(urlSourceSystem, fallback);
        }
    } catch {
        // Ignore URL parsing issues and fall back to local storage.
    }

    try {
        return normalizeActivationSourceSystem(window.localStorage.getItem("cdp_source_system"), fallback);
    } catch {
        return normalizeActivationSourceSystem(fallback);
    }
}

function mergeSegmentsById(...collections) {
    const merged = new Map();
    collections.flat().forEach((segment) => {
        if (!segment || typeof segment !== "object") {
            return;
        }
        const id = String(segment.segment_id ?? segment.id ?? "").trim();
        if (!id) {
            return;
        }
        const pipelineStatus =
            segment.pipeline_status ?? segment._pipelineStatus ?? segment.status ?? "Ready for activation";
        merged.set(id, {
            ...merged.get(id),
            ...segment,
            id,
            segment_id: id,
            status: pipelineStatus,
        });
    });
    return [...merged.values()];
}

function segmentBelongsToActivationSource(segment, sourceSystem) {
    const segmentSource = String(segment?.source_system ?? segment?.sourceSystem ?? "")
        .trim()
        .toLowerCase();
    return !segmentSource || segmentSource === "all" || segmentSource === sourceSystem;
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            accept: "application/json",
            ...options.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`Request failed with ${response.status} ${response.statusText}.`);
    }
    return response.json();
}

async function postJson(url, payload) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            accept: "application/json",
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Request failed with ${response.status} ${response.statusText}.`);
    }
    return response.json();
}

function createBlueprintSignature(form, blueprint) {
    return JSON.stringify({
        form,
        phaseHeaders: blueprint.phaseHeaders,
        nodes: blueprint.nodes,
        edges: blueprint.edges,
        nodeDetails: nodeDetailsMapToArray(blueprint.nodeDetails),
    });
}

function createDefaultNodeDetail(node) {
    return {
        title: node.title?.filter(Boolean).join(" ") || "New Node",
        kind: node.kind,
        accent: node.accent,
        rows: [
            { key: "segment", value: "Define audience or eligibility" },
            { key: "action", value: "Document channel, condition, or wait logic" },
        ],
        note: "Customize this node to match the journey logic you want to activate.",
    };
}

function Chrome({ activeRoute, meta, routes, sections, embedded = false, showSidebar = true, onRouteChange, children }) {
    const active = routes.find((route) => route.id === activeRoute) ?? routes[0];

    return (
        <div className={`app-shell ${embedded ? "embedded" : ""}`} style={{ "--accent": active?.accent ?? "#2680EB" }}>
            {!embedded ? (
                <header className="topbar">
                    <div className="exl-mark" aria-hidden="true">
                        <span>EXL</span>
                    </div>
                    <div className="topbar-brand">{meta.brand}</div>
                </header>
            ) : null}

            <div className="workspace-shell">
                {showSidebar ? (
                    <aside className="sidebar">
                        <div className="sidebar-head">
                            <div className="sidebar-title">Workspace</div>
                            <div className="sidebar-copy">Build campaigns, configure journeys, and validate automation from one activation suite.</div>
                        </div>

                        <div className="sidebar-body">
                            {sections.map((section) => (
                                <div className="sidebar-section" key={section.id}>
                                    <div className="sidebar-section-head">
                                        <div className="sidebar-section-title" style={{ color: section.accent }}>
                                            {section.title}
                                        </div>
                                        <div className="sidebar-section-copy">{section.description}</div>
                                    </div>
                                    <div className="sidebar-links">
                                        {section.items.map((item) => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                className={`sidebar-link ${activeRoute === item.id ? "on" : ""}`}
                                                onClick={() => onRouteChange(item.id)}
                                            >
                                                <span>{item.label}</span>
                                                <span className="sidebar-link-pill">{item.pill}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                ) : null}

                <main className="workspace-main">{children}</main>
            </div>
        </div>
    );
}

function LoadingScreen({
    embedded = false,
    showSidebar = true,
    message = "Loading the workspace shell, journey library, and editable activation canvas.",
}) {
    const bootstrap = getBootstrapPayload(createDefaultDashboardState());
    return (
        <Chrome
            activeRoute={embedded ? "bp" : bootstrap.routes[0]?.id ?? "bp"}
            meta={bootstrap.meta}
            routes={bootstrap.routes}
            sections={bootstrap.sections}
            embedded={embedded}
            showSidebar={showSidebar}
            onRouteChange={() => { }}
        >
            <div className="loading-screen">
                <span className="spinner large" />
                <div className="loading-title">Preparing EXL AI Accelerator</div>
                <div className="loading-copy">{message}</div>
            </div>
        </Chrome>
    );
}

function SuiteApp({
    bootstrap,
    actions,
    embedded = false,
    initialRoute = "bp",
    forcedRoute = null,
    showSidebar = true,
    onRouteRequest,
    externalActivatedSegments = [],
}) {
    const [activeRoute, setActiveRoute] = useState(forcedRoute ?? initialRoute);
    const [configTab, setConfigTab] = useState("audience");
    const [blueprintForm, setBlueprintForm] = useState(bootstrap.blueprint.form);
    const [journeyForm, setJourneyForm] = useState(bootstrap.journey.form);
    const [blueprintData, setBlueprintData] = useState(bootstrap.blueprint);
    const [journeyData, setJourneyData] = useState(bootstrap.journey);
    const [qaSuites, setQaSuites] = useState(bootstrap.qa.suites);
    const [suiteScore, setSuiteScore] = useState(bootstrap.qa.suiteScore);
    const [selectedNodeId, setSelectedNodeId] = useState(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [selectedProfileId, setSelectedProfileId] = useState(null);
    const [profileRun, setProfileRun] = useState(null);
    const [saveName, setSaveName] = useState("");
    const [blueprintBusy, setBlueprintBusy] = useState(false);
    const [journeyBusy, setJourneyBusy] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);
    const [runAllBusy, setRunAllBusy] = useState(false);
    const [sendState, setSendState] = useState("idle");
    const [showActivationCard, setShowActivationCard] = useState(false);
    const [promptDirty, setPromptDirty] = useState(false);
    const [activatedSegments, setActivatedSegments] = useState(externalActivatedSegments);
    const [blueprintProgress, setBlueprintProgress] = useState({ percent: 0, message: "Ready to generate" });
    const [journeyProgress, setJourneyProgress] = useState({ percent: 0, message: "Ready to generate" });
    const simulationTokenRef = useRef(0);
    const seedSignatureRef = useRef(createBlueprintSignature(bootstrap.blueprint.form, bootstrap.blueprint));
    const sendSignatureRef = useRef("");
    const sendTokenRef = useRef(0);
    const lastGeneratedPromptRef = useRef(bootstrap.blueprint.form?.brief ?? "");
    const blueprintFormRef = useRef(blueprintForm);
    const blueprintDataRef = useRef(blueprintData);
    const journeyFormRef = useRef(journeyForm);
    const qaSourceSystem = bootstrap.qa.sourceSystem ?? "sports";
    const qaSourceRef = useRef(qaSourceSystem);
    const selectedNode = selectedNodeId ? blueprintData.nodes.find((node) => node.id === selectedNodeId) : null;
    const selectedEdge = selectedEdgeId ? blueprintData.edges.find((edge) => edge.id === selectedEdgeId) : null;
    const selectedDetail = selectedNodeId ? blueprintData.nodeDetails[selectedNodeId] : null;
    const availableJourneyCategories = blueprintData.availableJourneyCategories ?? [];
    const filteredJourneyOptions = blueprintForm.journeyCategory
        ? getJourneysByCategory(blueprintForm.journeyCategory, blueprintData.availableJourneys ?? [])
        : [];
    const selectedCategory =
        availableJourneyCategories.find((category) => category.id === blueprintForm.journeyCategory) ?? null;
    const selectedJourneyOption = (blueprintData.availableJourneys ?? []).find(
        (journey) => journey.slug === blueprintForm.journeyType,
    );
    const isDirty =
        Boolean(blueprintForm.journeyType) && createBlueprintSignature(blueprintForm, blueprintData) !== seedSignatureRef.current;
    const journeySignature = useMemo(
        () =>
            JSON.stringify({
                platform: blueprintForm.platform,
                targetDate: blueprintForm.targetDate,
                brief: blueprintForm.brief,
                journeyForm,
                nodes: blueprintData.nodes,
                edges: blueprintData.edges,
                nodeDetails: nodeDetailsMapToArray(blueprintData.nodeDetails),
            }),
        [blueprintForm.brief, blueprintForm.platform, blueprintForm.targetDate, blueprintData.edges, blueprintData.nodeDetails, blueprintData.nodes, journeyForm],
    );
    const journeySignatureRef = useRef(journeySignature);

    useEffect(() => {
        setActivatedSegments(externalActivatedSegments ?? []);
    }, [externalActivatedSegments]);

    useEffect(() => {
        blueprintFormRef.current = blueprintForm;
    }, [blueprintForm]);

    useEffect(() => {
        blueprintDataRef.current = blueprintData;
    }, [blueprintData]);

    useEffect(() => {
        journeyFormRef.current = journeyForm;
    }, [journeyForm]);

    useEffect(() => {
        journeySignatureRef.current = journeySignature;
        if (sendState !== "idle" && sendSignatureRef.current && sendSignatureRef.current !== journeySignature) {
            setSendState("idle");
            setShowActivationCard(false);
            sendSignatureRef.current = "";
        }
    }, [journeySignature, sendState]);

    useEffect(() => {
        if (sendState !== "sent" || !showActivationCard) {
            return undefined;
        }

        const closeTimer = window.setTimeout(() => {
            setShowActivationCard(false);
        }, AJO_SUCCESS_CLOSE_DELAY_MS);

        return () => window.clearTimeout(closeTimer);
    }, [sendState, showActivationCard]);

    useEffect(() => {
        if (!forcedRoute) {
            return;
        }
        setActiveRoute(forcedRoute);
    }, [forcedRoute]);

    useEffect(() => {
        if (qaSourceRef.current === qaSourceSystem) {
            return;
        }
        qaSourceRef.current = qaSourceSystem;
        setQaSuites(bootstrap.qa.suites.map((suite) => ({ ...suite, status: "idle" })));
        setSuiteScore(null);
        setSelectedProfileId((current) => (bootstrap.qa.profiles.some((profile) => profile.id === current) ? current : null));
        setProfileRun(null);
    }, [bootstrap.qa.profiles, bootstrap.qa.suites, qaSourceSystem]);

    function setBlueprintBaseline(nextForm, nextBlueprint) {
        seedSignatureRef.current = createBlueprintSignature(nextForm, nextBlueprint);
    }

    function clearSelection() {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    }

    function syncFromJourney(nextBlueprint, nextJourney) {
        setBlueprintForm(nextBlueprint.form);
        setBlueprintData(nextBlueprint);
        setJourneyForm(nextJourney.form);
        setJourneyData(nextJourney);
        clearSelection();
        setSaveName("");
        setSendState("idle");
        setShowActivationCard(false);
        setPromptDirty(false);
        sendSignatureRef.current = "";
        lastGeneratedPromptRef.current = nextBlueprint.form?.brief ?? "";
        setBlueprintBaseline(nextBlueprint.form, nextBlueprint);
    }

    function changeBlueprintField(key, value) {
        const flowAffectingField = [
            "brief",
            "orchestrationType",
            "singleChannel",
            "singleTriggerType",
            "singleTriggerEvent",
            "singleSendOffsetHours",
            "singleOutcomeWindowHours",
            "singleUseHoldout",
            "singleUseAB",
        ].includes(key);

        setBlueprintForm((current) => ({ ...current, [key]: value }));

        if (key === "brief") {
            setPromptDirty(value !== lastGeneratedPromptRef.current);
            return;
        }
        if (flowAffectingField) {
            setPromptDirty(true);
        }
    }

    function changeJourneyField(key, value) {
        setJourneyForm((current) => ({ ...current, [key]: value }));
    }

    function toggleChannel(channel) {
        setJourneyForm((current) => ({
            ...current,
            channels: {
                ...current.channels,
                [channel]: !current.channels[channel],
            },
        }));
    }

    function selectNode(nodeId) {
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(null);
    }

    function selectEdge(edgeId) {
        setSelectedEdgeId(edgeId);
        setSelectedNodeId(null);
    }

    function updateNodeField(field, value) {
        if (!selectedNodeId) {
            return;
        }
        setBlueprintData((current) => {
            const nextNodes = current.nodes.map((node) =>
                node.id === selectedNodeId
                    ? (() => {
                        const nextNode = { ...node };
                        if (value === undefined && (field === "x" || field === "y" || field === "variantBadge")) {
                            delete nextNode[field];
                        } else {
                            nextNode[field] = value;
                        }
                        return nextNode;
                    })()
                    : node,
            );
            const nextDetail = current.nodeDetails[selectedNodeId]
                ? {
                    ...current.nodeDetails[selectedNodeId],
                    ...(field === "accent" ? { accent: value } : {}),
                    ...(field === "kind" ? { kind: value } : {}),
                }
                : null;
            return {
                ...current,
                nodes: nextNodes,
                nodeDetails: nextDetail
                    ? {
                        ...current.nodeDetails,
                        [selectedNodeId]: nextDetail,
                    }
                    : current.nodeDetails,
            };
        });
    }

    function updateNodeLines(section, index, value) {
        if (!selectedNodeId) {
            return;
        }
        setBlueprintData((current) => ({
            ...current,
            nodes: current.nodes.map((node) => {
                if (node.id !== selectedNodeId) {
                    return node;
                }
                const lines = [...(node[section] ?? []), ""];
                lines[index] = value;
                return {
                    ...node,
                    [section]: lines.slice(0, 2),
                };
            }),
        }));
    }

    function updateNodeDetail(field, value) {
        if (!selectedNodeId) {
            return;
        }
        setBlueprintData((current) => ({
            ...current,
            nodeDetails: {
                ...current.nodeDetails,
                [selectedNodeId]: {
                    ...current.nodeDetails[selectedNodeId],
                    [field]: value,
                },
            },
        }));
    }

    function updateNodeDetailRow(index, field, value) {
        if (!selectedNodeId) {
            return;
        }
        setBlueprintData((current) => {
            const rows = current.nodeDetails[selectedNodeId].rows.map((row, rowIndex) =>
                rowIndex === index ? { ...row, [field]: value } : row,
            );
            return {
                ...current,
                nodeDetails: {
                    ...current.nodeDetails,
                    [selectedNodeId]: {
                        ...current.nodeDetails[selectedNodeId],
                        rows,
                    },
                },
            };
        });
    }

    function addNodeDetailRow() {
        if (!selectedNodeId) {
            return;
        }
        setBlueprintData((current) => ({
            ...current,
            nodeDetails: {
                ...current.nodeDetails,
                [selectedNodeId]: {
                    ...current.nodeDetails[selectedNodeId],
                    rows: [...current.nodeDetails[selectedNodeId].rows, { key: "newKey", value: "newValue" }],
                },
            },
        }));
    }

    function removeNodeDetailRow(index) {
        if (!selectedNodeId) {
            return;
        }
        setBlueprintData((current) => ({
            ...current,
            nodeDetails: {
                ...current.nodeDetails,
                [selectedNodeId]: {
                    ...current.nodeDetails[selectedNodeId],
                    rows: current.nodeDetails[selectedNodeId].rows.filter((_, rowIndex) => rowIndex !== index),
                },
            },
        }));
    }

    function updateNodePosition(nodeId, position) {
        setBlueprintData((current) => ({
            ...current,
            nodes: current.nodes.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        x: Math.round(position.x),
                        y: Math.round(position.y),
                    }
                    : node,
            ),
        }));
    }

    function addNode() {
        const nodeCount = blueprintData.nodes.length;
        const draft = createNodeDraft(nodeCount);
        setBlueprintData((current) => ({
            ...current,
            nodes: [...current.nodes, draft],
            nodeDetails: {
                ...current.nodeDetails,
                [draft.id]: createDefaultNodeDetail(draft),
            },
            stats: current.stats.map((item) =>
                item.label === "Journey nodes"
                    ? {
                        ...item,
                        value: String(current.nodes.length + 1),
                    }
                    : item,
            ),
        }));
        selectNode(draft.id);
    }

    function removeNode(nodeId) {
        setBlueprintData((current) => {
            const nextNodes = current.nodes.filter((node) => node.id !== nodeId);
            const nextEdges = current.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
            const nextDetails = { ...current.nodeDetails };
            delete nextDetails[nodeId];
            return {
                ...current,
                nodes: nextNodes,
                edges: nextEdges,
                nodeDetails: nextDetails,
                stats: current.stats.map((item) =>
                    item.label === "Journey nodes"
                        ? {
                            ...item,
                            value: String(nextNodes.length),
                        }
                        : item,
                ),
            };
        });
        clearSelection();
    }

    function addEdge() {
        const base = createEdgeDraft(blueprintData.nodes, blueprintData.edges.length);
        const from = selectedNodeId ?? base.from;
        const to = blueprintData.nodes.find((node) => node.id !== from)?.id ?? base.to;
        const draft = { ...base, from, to };
        setBlueprintData((current) => ({
            ...current,
            edges: [...current.edges, draft],
        }));
        selectEdge(draft.id);
    }

    function updateEdgeField(field, value) {
        if (!selectedEdgeId) {
            return;
        }
        setBlueprintData((current) => ({
            ...current,
            edges: current.edges.map((edge) =>
                edge.id === selectedEdgeId
                    ? {
                        ...edge,
                        [field]: value,
                    }
                    : edge,
            ),
        }));
    }

    function removeEdge(edgeId) {
        setBlueprintData((current) => ({
            ...current,
            edges: current.edges.filter((edge) => edge.id !== edgeId),
        }));
        clearSelection();
    }

    function deleteSelection() {
        if (selectedNodeId) {
            removeNode(selectedNodeId);
            return;
        }
        if (selectedEdgeId) {
            removeEdge(selectedEdgeId);
        }
    }

    async function animateProgress(steps, setProgressState, delayMs) {
        for (const step of steps) {
            setProgressState(step);
            await wait(delayMs);
        }
    }

    async function handleJourneyCategoryChange(categoryId) {
        if (!categoryId) {
            setBlueprintForm((current) => ({
                ...current,
                journeyCategory: "",
                journeyType: "",
            }));
            return;
        }
        setBlueprintForm((current) => ({
            ...current,
            journeyCategory: categoryId,
            journeyType: "",
        }));
    }

    async function handleJourneyTypeChange(slug) {
        if (!slug) {
            changeBlueprintField("journeyType", "");
            return;
        }
        const result = await actions.selectJourney(slug);
        syncFromJourney(result.blueprint, result.journey);
    }

    async function handleBlueprintGenerate() {
        setBlueprintBusy(true);
        try {
            let applied = applyPromptToJourneyDraft({
                prompt: blueprintFormRef.current.brief,
                blueprintForm: blueprintFormRef.current,
                blueprintNodes: blueprintDataRef.current.nodes,
                blueprintEdges: blueprintDataRef.current.edges,
                blueprintNodeDetails: blueprintDataRef.current.nodeDetails,
                journeyForm: journeyFormRef.current,
                blueprintStats: blueprintDataRef.current.stats,
            });

            let nextPhaseHeaders = blueprintDataRef.current.phaseHeaders;
            if (applied.blueprintForm.orchestrationType === "single-touchpoint") {
                const singleBlueprint = buildSingleTouchpointDraft({
                    blueprintForm: {
                        ...applied.blueprintForm,
                        ...(Number.isFinite(applied.adjustments?.waitDays)
                            ? {
                                singleSendOffsetHours: Math.max(0, Math.min(168, Number(applied.adjustments.waitDays) * 24)),
                            }
                            : {}),
                    },
                    journeyForm: applied.journeyForm,
                    blueprintStats: blueprintDataRef.current.stats,
                });
                applied = {
                    ...applied,
                    blueprintForm: singleBlueprint.blueprintForm,
                    journeyForm: singleBlueprint.journeyForm,
                    nodes: singleBlueprint.nodes,
                    edges: singleBlueprint.edges,
                    nodeDetails: singleBlueprint.nodeDetails,
                    stats: singleBlueprint.stats,
                };
                nextPhaseHeaders = singleBlueprint.phaseHeaders;
            }

            const preparedBlueprint = {
                ...blueprintDataRef.current,
                phaseHeaders: nextPhaseHeaders,
                nodes: applied.nodes,
                edges: applied.edges,
                nodeDetails: applied.nodeDetails,
                stats: applied.stats,
            };

            blueprintFormRef.current = applied.blueprintForm;
            journeyFormRef.current = applied.journeyForm;
            blueprintDataRef.current = preparedBlueprint;

            const payload = {
                form: applied.blueprintForm,
                phaseHeaders: preparedBlueprint.phaseHeaders,
                nodes: preparedBlueprint.nodes,
                edges: preparedBlueprint.edges,
                nodeDetails: nodeDetailsMapToArray(preparedBlueprint.nodeDetails),
            };
            const [result] = await Promise.all([
                actions.generateBlueprint(payload),
                animateProgress(blueprintDataRef.current.progress, setBlueprintProgress, 420),
            ]);
            setBlueprintForm(applied.blueprintForm);
            setJourneyForm(applied.journeyForm);
            setBlueprintData({
                ...result,
                stats: applied.stats,
            });
            setPromptDirty(false);
            lastGeneratedPromptRef.current = applied.blueprintForm?.brief ?? "";
        } finally {
            setBlueprintBusy(false);
        }
    }

    async function handleSaveJourney() {
        const trimmed = saveName.trim();
        if (!trimmed || !selectedCategory || !blueprintForm.journeyType) {
            return;
        }
        setSaveBusy(true);
        try {
            const result = await actions.saveJourneyAsNew({
                categoryId: blueprintForm.journeyCategory,
                categoryName: selectedCategory.name,
                categoryDescription: selectedCategory.description,
                subCategoryId: selectedJourneyOption?.subCategoryId ?? blueprintForm.journeyCategory,
                subCategoryName: selectedJourneyOption?.subCategoryName ?? selectedCategory.name,
                clientTag: selectedJourneyOption?.clientTag ?? "",
                name: trimmed,
                form: blueprintForm,
                phaseHeaders: blueprintData.phaseHeaders,
                nodes: blueprintData.nodes,
                edges: blueprintData.edges,
                nodeDetails: nodeDetailsMapToArray(blueprintData.nodeDetails),
                journeyForm,
            });
            syncFromJourney(result.blueprint, result.journey);
        } finally {
            setSaveBusy(false);
        }
    }

    async function handleJourneyGenerate() {
        setJourneyBusy(true);
        try {
            const [result] = await Promise.all([
                actions.generateJourneyConfig(journeyForm),
                animateProgress(journeyData.progress, setJourneyProgress, 420),
            ]);
            setJourneyData(result);
        } finally {
            setJourneyBusy(false);
        }
        // Switch to QA tab — EmbeddedQAApp will auto-synth from there.
        startTransition(() => setConfigTab("qa"));
    }

    async function handleSendJourney() {
        const token = sendTokenRef.current + 1;
        sendTokenRef.current = token;
        const signatureAtSend = journeySignatureRef.current;
        setShowActivationCard(false);
        setSendState("sending");
        await wait(AJO_PREPARE_DELAY_MS);

        if (sendTokenRef.current !== token) {
            return;
        }
        if (journeySignatureRef.current === signatureAtSend) {
            sendSignatureRef.current = signatureAtSend;
            setShowActivationCard(true);
            setSendState("ready");
            return;
        }
        setSendState("idle");
        setShowActivationCard(false);
    }

    async function handleActivateJourney() {
        if (!sendSignatureRef.current) {
            return;
        }

        const token = sendTokenRef.current + 1;
        sendTokenRef.current = token;
        const signatureAtActivation = journeySignatureRef.current;
        const startedAt = Date.now();
        const liveSourceSystem = readLiveActivationSourceSystem(qaSourceSystem);
        setShowActivationCard(true);
        setSendState("activating");

        try {
            const result = await postJson(`${COPILOT_API}/send-to-ajo`, {
                journeyPayload: {
                    sourceSystem: liveSourceSystem,
                },
            });
            const elapsed = Date.now() - startedAt;
            const waitMs = Math.max(0, AJO_ACTIVATE_MIN_DELAY_MS - elapsed);
            if (waitMs > 0) {
                await wait(waitMs);
            }
            if (!result?.sent) {
                throw new Error("Send to AJO returned an unsuccessful response.");
            }
        } catch (error) {
            const elapsed = Date.now() - startedAt;
            const waitMs = Math.max(0, AJO_ACTIVATE_MIN_DELAY_MS - elapsed);
            if (waitMs > 0) {
                await wait(waitMs);
            }
            if (sendTokenRef.current !== token) {
                return;
            }
            console.error("Failed to activate journey in AJO.", error);
            setSendState("ready");
            return;
        }

        if (sendTokenRef.current !== token) {
            return;
        }
        if (journeySignatureRef.current === signatureAtActivation) {
            sendSignatureRef.current = signatureAtActivation;
            setShowActivationCard(true);
            setSendState("sent");
            return;
        }
        setSendState("idle");
        setShowActivationCard(false);
        sendSignatureRef.current = "";
    }

    async function handleRunAllSuites() {
        setRunAllBusy(true);
        setSuiteScore(null);
        setQaSuites((current) => current.map((suite) => ({ ...suite, status: "idle" })));
        try {
            const run = await actions.runAllSuites();
            for (const result of run.results) {
                setQaSuites((current) =>
                    current.map((suite) =>
                        suite.id === result.suiteId ? { ...suite, status: "running" } : suite,
                    ),
                );
                await wait(result.durationMs);
                setQaSuites((current) =>
                    current.map((suite) =>
                        suite.id === result.suiteId ? { ...suite, status: result.status } : suite,
                    ),
                );
                await wait(200);
            }
            setSuiteScore(run.score);
        } finally {
            setRunAllBusy(false);
        }
    }

    async function handleProfileSelect(profileId) {
        simulationTokenRef.current += 1;
        const token = simulationTokenRef.current;
        setSelectedProfileId(profileId);
        setProfileRun({ steps: [], running: true, summaryTone: "teal", summaryText: "" });

        const result = await actions.runProfileSimulation(profileId, journeyForm);
        if (token !== simulationTokenRef.current) {
            return;
        }

        setProfileRun({
            profile: result.profile,
            steps: [],
            running: true,
            summaryTone: result.summaryTone,
            summaryText: result.summaryText,
        });

        const revealed = [];
        for (const step of result.steps) {
            await wait(380);
            if (token !== simulationTokenRef.current) {
                return;
            }
            revealed.push(step);
            setProfileRun({
                profile: result.profile,
                steps: [...revealed],
                running: true,
                summaryTone: result.summaryTone,
                summaryText: result.summaryText,
            });
        }

        setProfileRun({
            profile: result.profile,
            steps: result.steps,
            running: false,
            summaryTone: result.summaryTone,
            summaryText: result.summaryText,
        });
    }

    function switchRoute(nextRoute) {
        if (onRouteRequest) {
            onRouteRequest(nextRoute);
            return;
        }
        startTransition(() => setActiveRoute(nextRoute));
    }

    return (
        <Chrome
            activeRoute={activeRoute}
            meta={bootstrap.meta}
            routes={bootstrap.routes}
            sections={bootstrap.sections}
            embedded={embedded}
            showSidebar={showSidebar}
            onRouteChange={switchRoute}
        >
            {activeRoute === "bp" ? (
                <BlueprintModule
                    data={blueprintData}
                    form={blueprintForm}
                    busy={blueprintBusy}
                    progress={blueprintProgress}
                    generateLabel={promptDirty ? "Regenerate flowchart" : "Generate Flowchart"}
                    selectedNode={selectedNode}
                    selectedEdge={selectedEdge}
                    selectedDetail={selectedDetail}
                    activatedSegments={activatedSegments}
                    filteredJourneyOptions={filteredJourneyOptions}
                    onSelectNode={selectNode}
                    onSelectEdge={selectEdge}
                    onClearSelection={clearSelection}
                    onFormChange={changeBlueprintField}
                    onJourneyCategoryChange={handleJourneyCategoryChange}
                    onJourneyTypeChange={handleJourneyTypeChange}
                    onGenerate={handleBlueprintGenerate}
                    onSendConfig={() => {
                        setConfigTab("audience");
                        switchRoute("cfg");
                    }}
                    onOpenQa={() => switchRoute("qa")}
                    isDirty={isDirty}
                    saveName={saveName}
                    saveBusy={saveBusy}
                    onSaveNameChange={setSaveName}
                    onSaveJourney={handleSaveJourney}
                    onAddNode={addNode}
                    onBackToCampaignManager={onRouteRequest ? () => onRouteRequest("campaigns") : null}
                    onAddEdge={addEdge}
                    onDeleteSelection={deleteSelection}
                    onNodeFieldChange={updateNodeField}
                    onNodeLineChange={updateNodeLines}
                    onDetailChange={updateNodeDetail}
                    onDetailRowChange={updateNodeDetailRow}
                    onAddDetailRow={addNodeDetailRow}
                    onRemoveDetailRow={removeNodeDetailRow}
                    onNodeMove={updateNodePosition}
                    onEdgeFieldChange={updateEdgeField}
                />
            ) : null}

            {activeRoute === "cfg" ? (
                <JourneyConfigModule
                    data={journeyData}
                    form={journeyForm}
                    tab={configTab}
                    busy={journeyBusy}
                    progress={journeyProgress}
                    platform={blueprintForm.platform}
                    orchestrationType={blueprintForm.orchestrationType}
                    singleTouchpoint={blueprintForm}
                    sendState={sendState}
                    showActivationCard={showActivationCard}
                    journeyId={blueprintForm.journeyType || null}
                    onTabChange={(nextTab) => startTransition(() => setConfigTab(nextTab))}
                    onFormChange={changeJourneyField}
                    onToggleChannel={toggleChannel}
                    onGenerate={handleJourneyGenerate}
                    onSend={handleSendJourney}
                    onActivate={handleActivateJourney}
                />
            ) : null}

            {activeRoute === "qa" ? (
                <QaModule
                    profiles={bootstrap.qa.profiles}
                    suites={qaSuites}
                    suiteScore={suiteScore}
                    runAllBusy={runAllBusy}
                    selectedProfileId={selectedProfileId}
                    profileRun={profileRun}
                    automationPlaybook={bootstrap.qa.automationPlaybook}
                    sourceLabel={bootstrap.qa.sourceLabel}
                    onRunAll={handleRunAllSuites}
                    onSelectProfile={handleProfileSelect}
                />
            ) : null}
        </Chrome>
    );
}

export function EmbeddedActivationApp({ activatedSegments = [], forcedRoute = "bp", showSidebar = false, onRouteRequest, initialJourneySlug = null }) {
    const [state, setState] = useState(createDefaultDashboardState());
    const [journeys, setJourneys] = useState(PRECONFIGURED_JOURNEYS);
    const [segments, setSegments] = useState(SEGMENT_LIBRARY);
    const [persistedActivatedSegments, setPersistedActivatedSegments] = useState([]);
    const [sourceSystem, setSourceSystem] = useState(() => readLiveActivationSourceSystem());
    const [loading, setLoading] = useState(true);
    const stateRef = useRef(state);
    const journeysRef = useRef(journeys);
    const segmentsRef = useRef(segments);
    const initialSlugApplied = useRef(false);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    useEffect(() => {
        journeysRef.current = journeys;
    }, [journeys]);

    useEffect(() => {
        segmentsRef.current = segments;
    }, [segments]);

    useEffect(() => {
        const syncSourceSystem = (event) => {
            const nextSource = event?.detail
                ? normalizeActivationSourceSystem(event.detail, sourceSystem)
                : readLiveActivationSourceSystem(sourceSystem);
            setSourceSystem((current) => (current === nextSource ? current : nextSource));
        };
        window.addEventListener("focus", syncSourceSystem);
        window.addEventListener("storage", syncSourceSystem);
        window.addEventListener("cdp-source-system-change", syncSourceSystem);
        return () => {
            window.removeEventListener("focus", syncSourceSystem);
            window.removeEventListener("storage", syncSourceSystem);
            window.removeEventListener("cdp-source-system-change", syncSourceSystem);
        };
    }, [sourceSystem]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        setLoading(true);
        initialSlugApplied.current = false;
        // Clear the previous source immediately. If the next bootstrap is
        // unavailable, the workspace falls back to its governed defaults
        // instead of exposing audiences or report state from another source.
        const sourceDefaults = createDefaultDashboardState();
        journeysRef.current = PRECONFIGURED_JOURNEYS;
        segmentsRef.current = SEGMENT_LIBRARY;
        setJourneys(PRECONFIGURED_JOURNEYS);
        setSegments(SEGMENT_LIBRARY);
        setPersistedActivatedSegments([]);
        setState(sourceDefaults);

        async function loadBootstrap() {
            try {
                const payload = await fetchJson(
                    `${COPILOT_API}/bootstrap?source_system=${encodeURIComponent(sourceSystem)}`,
                    { signal: controller.signal },
                );
                if (!active) {
                    return;
                }

                const nextJourneys =
                    Array.isArray(payload.journeys) && payload.journeys.length ? hydrateJourneyRecords(payload.journeys) : PRECONFIGURED_JOURNEYS;
                const customSegments = Array.isArray(payload.customSegments) ? payload.customSegments : [];
                const nextSegments = mergeSegmentsById(SEGMENT_LIBRARY, customSegments);
                const publishedSegments = Array.isArray(payload.activatedSegments)
                    ? payload.activatedSegments
                    : [];

                journeysRef.current = nextJourneys;
                segmentsRef.current = nextSegments;

                setJourneys(nextJourneys);
                setSegments(nextSegments);
                setPersistedActivatedSegments(publishedSegments);
                setState((current) => {
                    const defaultState = createDefaultDashboardState();
                    return {
                        ...defaultState,
                        segmentSourceUrl: payload.defaultSegmentSourceUrl ?? current.segmentSourceUrl,
                        campaignsJourneysReport:
                            payload.campaignsJourneysReport ?? defaultState.campaignsJourneysReport,
                    };
                });
            } catch (error) {
                if (!active || error?.name === "AbortError") {
                    return;
                }
                console.error("Unable to load copilot bootstrap from Flask.", error);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        void loadBootstrap();

        return () => {
            active = false;
            controller.abort();
        };
    }, [sourceSystem]);

    const bootstrap = getBootstrapPayload({
        ...state,
        availableJourneys: journeys,
        availableSegments: segments,
    });
    const effectiveActivatedSegments = useMemo(
        () =>
            mergeSegmentsById(
                persistedActivatedSegments.filter((segment) =>
                    segmentBelongsToActivationSource(segment, sourceSystem),
                ),
                (activatedSegments ?? []).filter((segment) =>
                    segmentBelongsToActivationSource(segment, sourceSystem),
                ),
            ),
        [persistedActivatedSegments, activatedSegments, sourceSystem],
    );

    if (loading) {
        return <LoadingScreen embedded showSidebar={showSidebar} message="Loading Activation workspace, saved journeys, and custom audience segments." />;
    }

    // Auto-select the journey once after bootstrap finishes loading
    if (initialJourneySlug && !initialSlugApplied.current) {
        initialSlugApplied.current = true;
        let preselect = initialJourneySlug.startsWith("ai-generated-")
            ? (() => {
                try {
                    // Check sessionStorage first (just generated this session), then localStorage
                    const ss = JSON.parse(sessionStorage.getItem("ai_generated_journey") || "null");
                    if (ss && ss.slug === initialJourneySlug) return ss;
                    const ls = JSON.parse(localStorage.getItem("ai_generated_journeys") || "[]");
                    return ls.find((j) => j.slug === initialJourneySlug) || null;
                } catch { return null; }
            })()
            : null;
        if (!preselect) preselect = findJourneyBySlug(initialJourneySlug, journeysRef.current);
        if (preselect) {
            // If it's an AI-generated journey not already in journeysRef, inject it so the
            // builder's "Journey type" dropdown can resolve its name from availableJourneys.
            if (preselect._aiGenerated && !journeysRef.current.find((j) => j.slug === preselect.slug)) {
                journeysRef.current = [preselect, ...journeysRef.current];
            }
            const hasNodes = Array.isArray(preselect.nodes) && preselect.nodes.length > 0;
            const nextState = {
                ...stateRef.current,
                blueprintForm: preselect.blueprintForm,
                blueprintPhaseHeaders: preselect.phaseHeaders,
                journeyForm: preselect.journeyForm,
                blueprintNodes: preselect.nodes,
                blueprintEdges: preselect.edges,
                blueprintNodeDetails: preselect.nodeDetails,
                selectedJourneySlug: preselect.slug,
                blueprintGenerated: hasNodes,
                blueprintGeneratedAt: hasNodes ? Date.now() : undefined,
                journeyGenerated: false,
            };
            stateRef.current = nextState;
            setState(nextState);
        }
    }

    return (
        <SuiteApp
            key={sourceSystem}
            bootstrap={bootstrap}
            embedded
            initialRoute={forcedRoute}
            forcedRoute={forcedRoute}
            showSidebar={showSidebar}
            onRouteRequest={onRouteRequest}
            externalActivatedSegments={effectiveActivatedSegments}
            actions={{
                selectJourney: async (slug) => {
                    const journey = findJourneyBySlug(slug, journeysRef.current);
                    const nextState = {
                        ...stateRef.current,
                        blueprintForm: journey.blueprintForm,
                        blueprintPhaseHeaders: journey.phaseHeaders,
                        journeyForm: journey.journeyForm,
                        blueprintNodes: journey.nodes,
                        blueprintEdges: journey.edges,
                        blueprintNodeDetails: journey.nodeDetails,
                        selectedJourneySlug: journey.slug,
                        blueprintGenerated: false,
                        journeyGenerated: false,
                    };
                    stateRef.current = nextState;
                    setState(nextState);
                    const payload = getBootstrapPayload({
                        ...nextState,
                        availableJourneys: journeysRef.current,
                        availableSegments: segmentsRef.current,
                    });
                    return {
                        blueprint: payload.blueprint,
                        journey: payload.journey,
                    };
                },
                generateBlueprint: async ({ form, phaseHeaders, nodes, edges, nodeDetails }) => {
                    const nextState = {
                        ...stateRef.current,
                        blueprintForm: form,
                        blueprintPhaseHeaders: phaseHeaders ?? stateRef.current.blueprintPhaseHeaders,
                        blueprintNodes: nodes,
                        blueprintEdges: edges,
                        blueprintNodeDetails: nodeDetails,
                        selectedJourneySlug: form.journeyType,
                        blueprintGenerated: true,
                        blueprintGeneratedAt: Date.now(),
                    };
                    stateRef.current = nextState;
                    setState(nextState);
                    return getBootstrapPayload({
                        ...nextState,
                        availableJourneys: journeysRef.current,
                        availableSegments: segmentsRef.current,
                    }).blueprint;
                },
                saveJourneyAsNew: async ({
                    categoryId,
                    categoryName,
                    categoryDescription,
                    subCategoryId,
                    subCategoryName,
                    clientTag,
                    name,
                    form,
                    phaseHeaders,
                    nodes,
                    edges,
                    nodeDetails,
                    journeyForm,
                }) => {
                    const slug = makeUniqueJourneySlug(name, journeysRef.current);
                    const record = buildJourneyRecord({
                        categoryId,
                        categoryName,
                        categoryDescription,
                        subCategoryId,
                        subCategoryName,
                        clientTag,
                        slug,
                        name,
                        blueprintForm: form,
                        phaseHeaders,
                        journeyForm,
                        nodes,
                        edges,
                        nodeDetails,
                        isPreset: false,
                    });
                    await postJson(`${COPILOT_API}/journeys`, { journey: record });
                    const nextJourneys = [...journeysRef.current, record];
                    const nextState = {
                        ...stateRef.current,
                        blueprintForm: record.blueprintForm,
                        blueprintPhaseHeaders: record.phaseHeaders,
                        journeyForm: record.journeyForm,
                        blueprintNodes: record.nodes,
                        blueprintEdges: record.edges,
                        blueprintNodeDetails: record.nodeDetails,
                        selectedJourneySlug: record.slug,
                        blueprintGenerated: true,
                        journeyGenerated: true,
                        blueprintGeneratedAt: Date.now(),
                        journeyGeneratedAt: Date.now(),
                    };
                    journeysRef.current = nextJourneys;
                    stateRef.current = nextState;
                    setJourneys(nextJourneys);
                    setState(nextState);
                    const payload = getBootstrapPayload({
                        ...nextState,
                        availableJourneys: nextJourneys,
                        availableSegments: segmentsRef.current,
                    });
                    return {
                        savedJourney: {
                            slug: record.slug,
                            name: record.name,
                            isPreset: false,
                        },
                        blueprint: payload.blueprint,
                        journey: payload.journey,
                    };
                },
                generateJourneyConfig: async (form) => {
                    const nextState = {
                        ...stateRef.current,
                        journeyForm: form,
                        journeyGenerated: true,
                        journeyGeneratedAt: Date.now(),
                    };
                    stateRef.current = nextState;
                    setState(nextState);
                    return getBootstrapPayload({
                        ...nextState,
                        availableJourneys: journeysRef.current,
                        availableSegments: segmentsRef.current,
                    }).journey;
                },
                runAllSuites: async () => {
                    const run = buildRunAllSuitesResult(bootstrap.qa.sourceSystem);
                    const nextState = {
                        ...stateRef.current,
                        suiteStatuses: run.results.map((result) => ({
                            suiteId: result.suiteId,
                            status: result.status,
                        })),
                        suiteScore: run.score,
                        lastRunAt: Date.now(),
                    };
                    stateRef.current = nextState;
                    setState(nextState);
                    return run;
                },
                runProfileSimulation: async (profileId, currentJourneyForm) => {
                    return buildProfileSimulation(profileId, currentJourneyForm, bootstrap.qa.sourceSystem);
                },
            }}
        />
    );
}
