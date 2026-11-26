import { tx, dateLocale } from "@/i18n/tx";
import React, { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Plus,
  Loader,
  Trash2,
  Pencil,
  X,
  Save,
  ChevronDown,
  Activity,
  Wind,
  RotateCcw,
} from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { farmDefaults } from "@/lib/windFarmDefaults";
import { fetchCompanies, fetchWindFarms } from "./shared/data";
import { updateProject, insertProjectReturning } from "./shared/data";
import PageGuard from "@/components/PageGuard";
import DeleteProjectDialog from "@/components/DeleteProjectDialog";
import { deleteProjectCascade } from "@/utils/deleteProjectCascade";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { canCreateProject, canEditProject } from "@/utils/projectPermissions";
import { fetchFilteredProjects } from "@/utils/projectFiltering";
import PageHeader from "@/components/layout/PageHeader";
import BentoCard from "@/components/ui/BentoCard";
import EmptyState from "@/components/ui/EmptyState";
import Reveal from "@/components/ui/Reveal";
import SearchField from "@/components/ui/SearchField";
import {
  OVERLINE,
  FOCUS,
  INPUT,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_DANGER,
  FADE,
  STATUS_OPTIONS,
  getInitials,
  staffName,
  StatusTag,
  TextField,
  SelectField,
  DateField,
  FormSection,
  StaffEditor,
  InfoItem,
} from "@/components/projects/formKit";

const TECHNOLOGISTS = ["VESTAS", "ACCIONA", "SIEMENS GAMESA"];
const CREATE_REQUIRED = ["name", "client", "wind_farm", "tecnologo", "access_method"];
const EDIT_REQUIRED = ["name", "tecnologo"];

// Secciones 1-3 del proyecto LPS (compartidas entre creación y edición)
const LpsFields = ({ idPrefix, values, onChange, companies, windFarms, required }) => {
  const { t } = useTranslation("common");
  const id = (name) => `${idPrefix}-${name}`;
  const isReq = (key) => required.includes(key);
  const text = (name, label, extra = {}) => (
    <TextField id={id(name)} label={tx(label)} value={values[name]} onChange={(v) => onChange(name, v)} required={isReq(name)} {...extra} />
  );
  const matchedClient = companies.find((c) => c.name === values.client);
  const farmOptions = (matchedClient ? windFarms.filter((wf) => wf.company_id === matchedClient.id) : [])
    .map((wf) => ({ value: wf.name, label: wf.name }));
  const generic = t("common.selectGeneric", { defaultValue: "Seleccione..." });

  const requiredSelect = (name, label, options, placeholder, disabled = false) => (
    <div className="min-w-0">
      <label htmlFor={id(name)} className="mb-1.5 block text-xs font-medium text-ink">
        {tx(label)}
        {isReq(name) && <span aria-hidden="true" className="ml-0.5 text-brand">*</span>}
      </label>
      <select
        id={id(name)}
        value={values[name] || ""}
        onChange={(e) => {
          onChange(name, e.target.value);
          // Al elegir el parque se propone el modelo WTG del catálogo (sigue siendo editable)
          if (name === "wind_farm") {
            const farm = windFarms.find((wf) => wf.name === e.target.value && (!matchedClient || wf.company_id === matchedClient.id));
            const { turbine_model } = farmDefaults(farm);
            if (turbine_model) onChange("turbine_model", turbine_model);
          }
        }}
        required={isReq(name)}
        disabled={disabled}
        className={INPUT}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <FormSection step={1} title={tx("Datos del proyecto")} description={tx("Identificación del proyecto y ubicación.")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {text("name", "Nombre del proyecto", { placeholder: tx("Ej. LPS Parque Eólico Norte") })}
          {text("contractor", "Empresa inspectora")}
          {requiredSelect(
            "client",
            "Cliente",
            companies.map((c) => ({ value: c.name, label: c.name })),
            t("common.selectClient", { defaultValue: "Seleccione un cliente..." }),
          )}
          {requiredSelect(
            "wind_farm",
            "Parque eólico",
            farmOptions,
            t("common.selectWindFarm", { defaultValue: "Seleccione un parque..." }),
            !values.client,
          )}
          <DateField id={id("start_date")} label={tx("Fecha de inicio")} value={values.start_date} onChange={(d) => onChange("start_date", d)} />
          <SelectField id={id("status")} label={tx("Estado")} value={values.status || "Planeación"} onChange={(v) => onChange("status", v)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </SelectField>
        </div>
      </FormSection>

      <FormSection step={2} title={tx("Aerogenerador")} description={tx("Características de la máquina inspeccionada.")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {text("turbine_model", "Modelo WTG")}
          {text("rotor_diameter", "Diámetro del rotor (m)", { type: "number", min: "0" })}
          {requiredSelect("tecnologo", "Tecnólogo", TECHNOLOGISTS.map((n) => ({ value: n, label: n })), generic)}
          {text("component", "Componente")}
        </div>
      </FormSection>

      <FormSection step={3} title={tx("Inspección")} description={tx("Cómo y por qué se realiza la inspección.")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {requiredSelect(
            "access_method",
            "Método de acceso",
            [
              { value: "Cuerdas", label: t("methods.ropes", { defaultValue: "Cuerdas" }) },
              { value: "Plataforma", label: t("methods.platform", { defaultValue: "Plataforma" }) },
              { value: "Drone", label: t("methods.drone", { defaultValue: "Drone" }) },
              { value: "Grúa", label: t("methods.crane", { defaultValue: "Grúa" }) },
            ],
            generic,
          )}
          {text("inspection_reason", "Motivo de inspección")}
        </div>
      </FormSection>
    </>
  );
};

const LpsCard = ({ project, canEdit, onEdit }) => {
  const { t } = useTranslation("common");
  const meta = project.lps_metadata || {};
  const staff = project.staff_list || project.staff || [];
  const start = project.start_date ? new Date(project.start_date).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }) : t("projects.noDefined");

  return (
    <li className="flex">
    <BentoCard className="flex w-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">{project.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-ink-muted">
            <Wind size={14} className="shrink-0 text-status-progress" aria-hidden="true" />
            {project.wind_farm}
          </p>
        </div>
        <StatusTag status={project.status || "Planeación"} />
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <InfoItem label={tx("Cliente")}>{project.client || "N/A"}</InfoItem>
          <InfoItem label={tx("Empresa inspectora")}>{project.contractor || "N/A"}</InfoItem>
          <InfoItem label={tx("Modelo WTG")}>{project.turbine_model || "N/A"}</InfoItem>
          <InfoItem label={tx("Método de acceso")}>{meta.access_method || "N/A"}</InfoItem>
          <InfoItem label={tx("Tecnólogo")}>{meta.tecnologo || "N/A"}</InfoItem>
          <InfoItem label={tx("Inicio")}><span className="tabular-nums">{start}</span></InfoItem>
        </dl>

        {staff.length > 0 && (
          <div className="border-t border-line-subtle pt-3">
            <p className={`${OVERLINE} mb-2`}>
              Técnicos <span className="ml-1 tabular-nums text-ink-muted">({staff.length})</span>
            </p>
            <ul className="flex flex-wrap items-center gap-1.5">
              {staff.slice(0, 5).map((m) => (
                <li
                  key={m.id}
                  title={`${staffName(m)} - ${m.role}`}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-line-subtle bg-surface-card text-[11px] font-semibold text-ink"
                >
                  {getInitials(staffName(m))}
                </li>
              ))}
              {staff.length > 5 && (
                <li className="text-xs text-ink-muted">{t("common.andMore", { count: staff.length - 5 })}</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="border-t border-line-subtle p-3">
          <button type="button" onClick={onEdit} className={`${BTN_SECONDARY} w-full`}>
            <Pencil size={15} aria-hidden="true" />
            {tx("Editar proyecto")}
          </button>
        </div>
      )}
    </BentoCard>
    </li>
  );
};

const DataCapturePage = () => {
  const { t } = useTranslation("common");
  const { role, isAdmin } = useRolePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // --- Estados del formulario LPS ---
  const [projectName, setProjectName] = useState("");
  const [client, setClient] = useState("");
  const [windFarm, setWindFarm] = useState("");
  const [inspectingCompany, setInspectingCompany] = useState("VND GROUP");
  const [startDate, setStartDate] = useState();
  const [turbineModel, setTurbineModel] = useState("");
  const [rotorDiameter, setRotorDiameter] = useState("");
  const [component, setComponent] = useState("Pala");
  const [accessMethod, setAccessMethod] = useState("");
  const [inspectionReason, setInspectionReason] = useState(
    "Inspección Programada",
  );
  const [tecnologo, setTecnologo] = useState("");
  const [projectStatus, setProjectStatus] = useState("Planeación");

  // --- Estados de Personal (Catálogos y lista) ---
  const [companies, setCompanies] = useState([]);
  const [windFarms, setWindFarms] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    role: "",
    email: "",
    client_id: "",
    wind_farm_id: "",
  });

  // --- Estados de Proyectos y Edición ---
  const [existingProjects, setExistingProjects] = useState([]);
  const [editingProject, setEditingProject] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editStaffList, setEditStaffList] = useState([]);
  const [editNewStaff, setEditNewStaff] = useState({
    fullName: "",
    role: "",
    email: "",
    client_id: "",
    wind_farm_id: "",
  });

  // --- Estados Eliminación ---
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState("");

  useEffect(() => {
    getCurrentUser();
    fetchCatalogs();
  }, []);

  useEffect(() => {
    if (currentUser && role) {
      fetchExistingLpsProjects();
    }
  }, [currentUser, role]);

  const fetchCatalogs = async () => {
    try {
      const { data: companiesData, error: companiesError } = await fetchCompanies();
      if (companiesError) throw companiesError;
      if (companiesData) setCompanies(companiesData);

      const { data: windFarmsData, error: windFarmsError } = await fetchWindFarms();
      if (windFarmsError) throw windFarmsError;
      if (windFarmsData) setWindFarms(windFarmsData);
    } catch (error) {
      console.error("Error obteniendo catálogos:", error);
    }
  };

  const getCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error("Error getting current user:", error);
    }
  };

  const fetchExistingLpsProjects = async () => {
    try {
      setProjectsLoading(true);
      const filteredProjects = await fetchFilteredProjects(currentUser, role);

      // FILTRO ESTRICTO: Solo mostrar proyectos LPS
      const lpsProjects = filteredProjects.filter(
        (p) => p.project_type === "LPS",
      );
      setExistingProjects(lpsProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: tx("No se pudieron cargar los proyectos LPS"),
        variant: "destructive",
      });
      setExistingProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  // --- Manejo del Equipo Técnico (Igual que en ProjectsPage) ---
  const addStaffMember = () => {
    if (!newStaff.user_id || !newStaff.role) {
      toast({
        title: tx("Faltan campos"),
        description: tx("Elige a una persona registrada y su rol"),
        variant: "destructive",
      });
      return;
    }
    if (staffList.some((staff) => staff.user_id === newStaff.user_id || (staff.email && staff.email.toLowerCase() === newStaff.email.toLowerCase()))) {
      toast({
        title: tx("Correo duplicado"),
        description: tx("El técnico ya está en el equipo"),
        variant: "destructive",
      });
      return;
    }
    setStaffList((prev) => [...prev, { ...newStaff, id: Date.now() }]);
    setNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });
  };

  const removeStaffMember = (id) => {
    setStaffList((prev) => prev.filter((staff) => staff.id !== id));
  };

  // --- Lógica Principal de Creación LPS ---
  const handleCreateLpsProject = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!projectName || !client || !windFarm) {
        throw new Error(tx("Por favor completa Nombre, Cliente y Parque Eólico."));
      }
      if (staffList.length === 0) {
        throw new Error(
          tx("El proyecto debe tener al menos un miembro en el equipo técnico."),
        );
      }

      const { data: project, error: projectError } = await insertProjectReturning([
          {
            name: projectName,
            client: client,
            wind_farm: windFarm,
            status: projectStatus,
            project_type: "LPS", // Etiqueta obligatoria para aislamiento
            contractor: inspectingCompany,
            turbine_model: turbineModel,
            start_date: startDate?.toISOString(),
            staff_list: staffList,
            lps_metadata: {
              rotor_diameter: rotorDiameter,
              component: component,
              access_method: accessMethod,
              inspection_reason: inspectionReason,
              tecnologo: tecnologo,
            },
            created_at: new Date().toISOString(),
          },
        ]);

      if (projectError) throw projectError;

      if (currentUser) {
        await supabase.from("project_access").insert({
          project_id: project.id,
          user_id: currentUser.id,
          role: "admin",
        });
      }

      toast({
        title: tx("Proyecto LPS Creado"),
        description: tx("El proyecto {{projectName}} se guardó correctamente.", { projectName }),
      });

      resetForm();
      fetchExistingLpsProjects();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProjectName("");
    setClient("");
    setWindFarm("");
    setInspectingCompany("VND GROUP");
    setStartDate(undefined);
    setTurbineModel("");
    setRotorDiameter("");
    setComponent("Pala");
    setAccessMethod("");
    setInspectionReason("Inspección Programada");
    setTecnologo("");
    setProjectStatus("Planeación");
    setStaffList([]);
    setNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });
  };

  // --- Lógica de Edición LPS ---
  const openEditModal = (project) => {
    setEditingProject(project);
    const meta = project.lps_metadata || {};

    setEditForm({
      name: project.name,
      client: project.client,
      wind_farm: project.wind_farm,
      status: project.status || "Planeación",
      contractor: project.contractor || "VND GROUP",
      turbine_model: project.turbine_model || "",
      start_date: project.start_date ? new Date(project.start_date) : null,
      rotor_diameter: meta.rotor_diameter || "",
      component: meta.component || "Pala",
      access_method: meta.access_method || "",
      inspection_reason: meta.inspection_reason || "Inspección Programada",
      tecnologo: meta.tecnologo || "",
    });
    setEditStaffList(project.staff_list || project.staff || []);
    setEditNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });
  };

  const closeEditModal = () => {
    setEditingProject(null);
    setEditForm({});
    setEditStaffList([]);
  };

  const addEditStaffMember = () => {
    if (!editNewStaff.user_id || !editNewStaff.role) {
      toast({
        title: tx("Faltan campos"),
        description: tx("Elige a una persona registrada y su rol"),
        variant: "destructive",
      });
      return;
    }
    if (editStaffList.some((staff) => staff.user_id === editNewStaff.user_id || (staff.email && staff.email.toLowerCase() === editNewStaff.email.toLowerCase()))) {
      toast({
        title: tx("Correo duplicado"),
        description: tx("El técnico ya está en el equipo"),
        variant: "destructive",
      });
      return;
    }
    setEditStaffList((prev) => [
      ...prev,
      { ...editNewStaff, id: Date.now(), isNew: true },
    ]);
    setEditNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      if (editStaffList.length === 0)
        throw new Error(tx("El equipo no puede estar vacío."));

      const { error: projectError } = await updateProject(editingProject.id, {
          name: editForm.name,
          client: editForm.client,
          wind_farm: editForm.wind_farm,
          status: editForm.status,
          contractor: editForm.contractor,
          turbine_model: editForm.turbine_model,
          start_date: editForm.start_date?.toISOString(),
          staff_list: editStaffList,
          lps_metadata: {
            rotor_diameter: editForm.rotor_diameter,
            component: editForm.component,
            access_method: editForm.access_method,
            inspection_reason: editForm.inspection_reason,
            tecnologo: editForm.tecnologo,
          },
          updated_at: new Date().toISOString(),
        });

      if (projectError) throw projectError;

      toast({
        title: tx("Proyecto Actualizado"),
        description: tx("Cambios guardados."),
      });
      closeEditModal();
      fetchExistingLpsProjects();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEditLoading(false);
    }
  };

  // --- Lógica Eliminación ---
  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setProjectToDelete(null);
    setDeleteProgress("");
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteProjectCascade(projectToDelete, setDeleteProgress, t);
      toast({ title: tx("Eliminado"), description: tx("Proyecto LPS eliminado.") });
      setShowDeleteDialog(false);
      closeEditModal();
      fetchExistingLpsProjects();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };


  // --- Estado local de la capa visual ---
  const [createOpen, setCreateOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const editCloseRef = useRef(null);

  // Accesibilidad de la hoja de edición: Escape cierra y el foco entra al diálogo
  useEffect(() => {
    if (!editingProject) return undefined;
    editCloseRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !showDeleteDialog) closeEditModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingProject, showDeleteDialog]);

  // Adaptadores: el formulario de creación usa estados sueltos, el de edición un objeto
  const createValues = {
    name: projectName,
    contractor: inspectingCompany,
    client,
    wind_farm: windFarm,
    status: projectStatus,
    start_date: startDate,
    turbine_model: turbineModel,
    rotor_diameter: rotorDiameter,
    tecnologo,
    component,
    access_method: accessMethod,
    inspection_reason: inspectionReason,
  };
  const createSetters = {
    name: setProjectName,
    contractor: setInspectingCompany,
    client: setClient,
    wind_farm: setWindFarm,
    status: setProjectStatus,
    start_date: setStartDate,
    turbine_model: setTurbineModel,
    rotor_diameter: setRotorDiameter,
    tecnologo: setTecnologo,
    component: setComponent,
    access_method: setAccessMethod,
    inspection_reason: setInspectionReason,
  };
  // Al cambiar el cliente, el parque elegido deja de ser válido
  const handleCreateChange = (key, value) => {
    createSetters[key](value);
    if (key === "client") setWindFarm("");
  };
  const handleEditChange = (key, value) =>
    setEditForm((prev) => ({ ...prev, [key]: value, ...(key === "client" ? { wind_farm: "" } : {}) }));

  const searchQuery = listSearch.trim().toLowerCase();
  const visibleProjects = existingProjects.filter((p) => {
    const matchesStatus = statusFilter === "all" || (p.status || "Planeación") === statusFilter;
    const matchesSearch =
      !searchQuery ||
      [p.name, p.client, p.wind_farm].some((v) => (v || "").toLowerCase().includes(searchQuery));
    return matchesStatus && matchesSearch;
  });

  return (
    <PageGuard allowedRoles={["admin", "dev"]}>
      <MotionConfig reducedMotion="user">
        <Helmet>
          <title>{tx("Inspección LPS - VINDGROUP")}</title>
        </Helmet>

        <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Encabezado */}
            <Reveal>
              <PageHeader
                icon={<Activity size={24} />}
                overline={tx("Gestión de activos eólicos")}
                title={tx("Inspección LPS")}
                description={tx("Creación y gestión de proyectos de inspección LPS")}
              />
            </Reveal>

            {/* Creación de proyecto */}
            {canCreateProject(role) && (
              <BentoCard
                as={motion.section}
                flat
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...FADE, delay: 0.05 }}
                aria-labelledby="create-title"
              >
                <button
                  type="button"
                  onClick={() => setCreateOpen((o) => !o)}
                  aria-expanded={createOpen}
                  aria-controls="create-lps-panel"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                      <Plus size={20} />
                    </span>
                    <span className="min-w-0">
                      <span id="create-title" className="block text-base font-semibold text-ink">{tx("Nuevo proyecto LPS")}</span>
                      <span className="block text-xs text-ink-muted">{tx("Registra la campaña, la máquina y el equipo técnico.")}</span>
                    </span>
                  </span>
                  <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-ink-muted transition-transform ${createOpen ? "rotate-180" : ""}`} />
                </button>

                {createOpen && (
                  <form
                    id="create-lps-panel"
                    onSubmit={handleCreateLpsProject}
                    className="space-y-4 border-t border-line-subtle p-4 sm:p-5"
                  >
                    <LpsFields
                      idPrefix="create"
                      values={createValues}
                      onChange={handleCreateChange}
                      companies={companies}
                      windFarms={windFarms}
                      required={CREATE_REQUIRED}
                    />
                    <StaffEditor
                      idPrefix="create-staff"
                      newStaff={newStaff}
                      setNewStaff={setNewStaff}
                      onAdd={addStaffMember}
                      list={staffList}
                      onRemove={(staff) => removeStaffMember(staff.id)}
                      companies={companies}
                      windFarms={windFarms}
                      emptyHint={tx("El proyecto debe tener al menos un miembro en el equipo técnico.")}
                    />

                    <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:justify-end">
                      <button type="button" onClick={resetForm} className={BTN_SECONDARY}>
                        <RotateCcw size={15} aria-hidden="true" />
                        {tx("Limpiar formulario")}
                      </button>
                      <button type="submit" disabled={loading} className={`${BTN_PRIMARY} sm:min-w-[220px]`}>
                        {loading ? (
                          <Loader size={16} className="animate-spin text-ink" aria-hidden="true" />
                        ) : (
                          <Plus size={16} aria-hidden="true" />
                        )}
                        {tx("Crear proyecto LPS")}
                      </button>
                    </div>
                  </form>
                )}
              </BentoCard>
            )}

            {/* Proyectos existentes */}
            <BentoCard
              as={motion.section}
              flat
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...FADE, delay: 0.1 }}
              aria-labelledby="existing-title"
            >
              <div className="space-y-3 border-b border-line-subtle px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h2 id="existing-title" className={OVERLINE}>
                    {tx("Proyectos LPS existentes")}
                    <span className="ml-2 tabular-nums text-ink-muted">
                      ({visibleProjects.length}
                      {visibleProjects.length !== existingProjects.length ? ` / ${existingProjects.length}` : ""})
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-ink-muted">{tx("Consulta, edita o elimina las campañas de inspección LPS.")}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
                  <SearchField
                    value={listSearch}
                    onChange={setListSearch}
                    label={tx("Buscar proyecto")}
                    placeholder={tx("Buscar por proyecto, cliente o parque")}
                  />
                  <label className="block">
                    <span className="sr-only">{tx("Filtrar por estado")}</span>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={INPUT}>
                      <option value="all">{tx("Todos los estados")}</option>
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{t(o.key)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : existingProjects.length === 0 ? (
                  <EmptyState>{tx("No hay proyectos LPS creados aún.")}</EmptyState>
                ) : visibleProjects.length === 0 ? (
                  <EmptyState>{tx("Ningún proyecto coincide con los filtros")}</EmptyState>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleProjects.map((project) => (
                      <LpsCard
                        key={project.id}
                        project={project}
                        canEdit={canEditProject(currentUser, role, project)}
                        onEdit={() => openEditModal(project)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </BentoCard>
          </div>
        </div>

        {/* Hoja de edición */}
        <AnimatePresence>
          {editingProject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE}
              className="fixed inset-0 z-50 flex items-stretch justify-center bg-surface-base/70 sm:items-center sm:p-4"
              onClick={closeEditModal}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-dialog-title"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={FADE}
                className="flex h-full w-full flex-col overflow-hidden bg-surface-panel sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-md sm:border sm:border-line-subtle"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-subtle px-4 py-4 sm:px-6">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                      <Pencil size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className={OVERLINE}>{tx("Editar proyecto LPS")}</p>
                      <h2 id="edit-dialog-title" className="truncate text-lg font-semibold text-ink sm:text-xl">{editingProject.name}</h2>
                    </div>
                  </div>
                  <button
                    type="button"
                    ref={editCloseRef}
                    onClick={closeEditModal}
                    aria-label={tx("Cerrar")}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-subtle text-ink-muted transition-colors hover:border-line-medium hover:text-ink ${FOCUS}`}
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <form
                  id="edit-lps-form"
                  onSubmit={handleUpdateProject}
                  className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
                >
                  <LpsFields
                    idPrefix="edit"
                    values={editForm}
                    onChange={handleEditChange}
                    companies={companies}
                    windFarms={windFarms}
                    required={EDIT_REQUIRED}
                  />
                  <StaffEditor
                    idPrefix="edit-staff"
                    newStaff={editNewStaff}
                    setNewStaff={setEditNewStaff}
                    onAdd={addEditStaffMember}
                    list={editStaffList}
                    onRemove={(staff) => setEditStaffList((prev) => prev.filter((x) => x.id !== staff.id))}
                    companies={companies}
                    windFarms={windFarms}
                    emptyHint={tx("El equipo no puede estar vacío.")}
                  />
                </form>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-line-subtle bg-surface-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteDialog(true);
                      setProjectToDelete(editingProject);
                    }}
                    disabled={deleteLoading}
                    className={BTN_DANGER}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {tx("Eliminar proyecto")}
                  </button>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button type="button" onClick={closeEditModal} className={BTN_SECONDARY}>
                      {tx("Cancelar")}
                    </button>
                    <button type="submit" form="edit-lps-form" disabled={editLoading} className={`${BTN_PRIMARY} sm:min-w-[180px]`}>
                      {editLoading ? (
                        <Loader size={16} className="animate-spin text-ink" aria-hidden="true" />
                      ) : (
                        <Save size={16} aria-hidden="true" />
                      )}
                      {tx("Guardar cambios")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <DeleteProjectDialog
          isOpen={showDeleteDialog}
          onClose={closeDeleteDialog}
          project={projectToDelete}
          onConfirmDelete={handleConfirmDelete}
          isDeleting={deleteLoading}
          deleteProgress={deleteProgress}
        />
      </MotionConfig>
    </PageGuard>
  );
};

export default DataCapturePage;
