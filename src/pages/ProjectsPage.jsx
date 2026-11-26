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
  FolderKanban,
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


// Secciones 1-3 del proyecto (compartidas entre creación y edición)
const ProjectFields = ({ idPrefix, values, onChange, windFarms = [] }) => {
  const { t } = useTranslation("common");
  const id = (name) => `${idPrefix}-${name}`;
  const text = (name, label, extra = {}) => (
    <TextField id={id(name)} label={label} value={values[name]} onChange={(v) => onChange(name, v)} {...extra} />
  );

  // Parque del catálogo: al elegirlo se proponen el número de turbinas y el modelo (siguen siendo editables).
  const farmNames = windFarms.map((wf) => wf.name);
  const pickFarm = (name) => {
    onChange("wind_farm", name);
    const d = farmDefaults(windFarms.find((wf) => wf.name === name));
    onChange("turbine_count", d.turbine_count);
    onChange("turbine_model", d.turbine_model);
  };

  return (
    <>
      <FormSection step={1} title={t("projects.projectInfo", "Información del Proyecto")} description={tx("Identificación del proyecto y alcance de la campaña.")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {text("name", t("projects.projectName"), { required: true, placeholder: t("projects.placeholder.projectName") })}
          <SelectField id={id("wind_farm")} label={t("projects.windFarm")} required value={values.wind_farm || ""} onChange={pickFarm}>
            <option value="">{t("common.selectWindFarm", { defaultValue: "Seleccione un parque eólico" })}</option>
            {/* un proyecto antiguo con un parque escrito a mano no pierde su valor al editarlo */}
            {values.wind_farm && !farmNames.includes(values.wind_farm) && <option value={values.wind_farm}>{values.wind_farm}</option>}
            {windFarms.map((wf) => (
              <option key={wf.id} value={wf.name}>{wf.name}</option>
            ))}
          </SelectField>
          {text("client", t("projects.client"), { required: true, placeholder: t("projects.placeholder.client") })}
          {text("turbine_count", t("projects.turbineCount"), { required: true, type: "number", min: "1", placeholder: t("projects.placeholder.turbineCount") })}
          {text("turbine_model", t("projects.turbineModel", "Modelo de Turbina"), { placeholder: t("projects.placeholder.turbineModel", "Ej. Vestas V90") })}
          <SelectField id={id("status")} label={t("projects.status")} value={values.status || "Planeación"} onChange={(v) => onChange("status", v)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.key)}</option>
            ))}
          </SelectField>
        </div>
      </FormSection>

      <FormSection step={2} title={tx("Responsables")} description={tx("Contactos del cliente y del equipo de revisión. Opcionales.")}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[
            { k: "park_manager", label: t("projects.parkManager"), emailLabel: t("projects.managerEmail") },
            { k: "technical_lead", label: t("projects.technicalLead"), emailLabel: t("projects.techLeadEmail") },
            { k: "review_personnel", label: t("projects.reviewPersonnel"), emailLabel: t("projects.reviewPersonnelEmail") },
          ].map((g) => (
            <fieldset key={g.k} className="min-w-0 space-y-3 rounded-md border border-line-subtle p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-widest text-ink-muted">{g.label}</legend>
              {text(g.k, tx("Nombre"))}
              {text(`${g.k}_email`, g.emailLabel, { type: "email", placeholder: tx("correo@ejemplo.com") })}
            </fieldset>
          ))}
        </div>
      </FormSection>

      <FormSection step={3} title={tx("Cronograma")} description={tx("Fechas previstas de la campaña de inspección.")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateField id={id("start_date")} label={t("projects.startDate")} value={values.start_date} onChange={(d) => onChange("start_date", d)} />
          <DateField id={id("end_date")} label={t("projects.endDate")} value={values.end_date} onChange={(d) => onChange("end_date", d)} />
        </div>
      </FormSection>
    </>
  );
};

const ProjectCard = ({ project, canEdit, onEdit }) => {
  const { t } = useTranslation("common");
  const date = (d) => (d ? new Date(d).toLocaleDateString(dateLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }) : t("projects.noDefined"));
  const staff = project.staff || [];
  const contacts = [
    { label: t("projects.parkManager"), name: project.park_manager, email: project.park_manager_email },
    { label: t("projects.technicalLead"), name: project.technical_lead, email: project.technical_lead_email },
    { label: t("projects.reviewPersonnelLabel"), name: project.review_personnel, email: project.review_personnel_email },
  ].filter((c) => c.name);

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
        <StatusTag status={project.status} />
      </div>

      <div className="flex-1 space-y-4 px-4 py-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <InfoItem label={t("projects.clientLabel")}>{project.client || "N/A"}</InfoItem>
          <InfoItem label={t("projects.turbinesLabel")}>
            <span className="tabular-nums">{project.turbine_count}</span>
            {project.turbine_model ? <span className="text-ink-muted"> · {project.turbine_model}</span> : null}
          </InfoItem>
          <InfoItem label={t("projects.startDate")}><span className="tabular-nums">{date(project.start_date)}</span></InfoItem>
          <InfoItem label={t("projects.endDate")}><span className="tabular-nums">{date(project.end_date)}</span></InfoItem>
        </dl>

        {contacts.length > 0 && (
          <div className="space-y-2 border-t border-line-subtle pt-3">
            {contacts.map((c) => (
              <div key={c.label} className="min-w-0 text-sm">
                <span className={OVERLINE}>{c.label}</span>
                <p className="truncate text-ink">{c.name}</p>
                {c.email && <p className="truncate text-xs text-ink-muted">{c.email}</p>}
              </div>
            ))}
          </div>
        )}

        {staff.length > 0 && (
          <div className="border-t border-line-subtle pt-3">
            <p className={`${OVERLINE} mb-2`}>
              {t("projects.technicalTeamLabel")} <span className="ml-1 tabular-nums text-ink-muted">({staff.length})</span>
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
            {t("projects.editProject")}
          </button>
        </div>
      )}
    </BentoCard>
    </li>
  );
};

const ProjectsPage = () => {
  const { t } = useTranslation("common");
  const { role, isAdmin } = useRolePermissions();
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [startDate, setStartDate] = useState();
  const [endDate, setEndDate] = useState();
  const [loading, setLoading] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Estados del formulario de proyecto
  const [projectName, setProjectName] = useState("");
  const [windFarm, setWindFarm] = useState("");
  const [client, setClient] = useState("");
  const [projectStatus, setProjectStatus] = useState("Planeación");
  const [parkManager, setParkManager] = useState("");
  const [parkManagerEmail, setParkManagerEmail] = useState("");
  const [technicalLead, setTechnicalLead] = useState("");
  const [technicalLeadEmail, setTechnicalLeadEmail] = useState("");
  const [turbineCount, setTurbineCount] = useState("");
  const [turbineModel, setTurbineModel] = useState("");
  const [reviewPersonnel, setReviewPersonnel] = useState("");
  const [reviewPersonnelEmail, setReviewPersonnelEmail] = useState("");

  // Estados del personal (array para múltiples personas)

  // Estados del personal (array para múltiples personas)
  const [companies, setCompanies] = useState([]);
  const [windFarms, setWindFarms] = useState([]);
  const [staffList, setStaffList] = useState([]);

  const [newStaff, setNewStaff] = useState({
    fullName: "",
    role: "",
    email: "",
    client_id: "", // <-- NUEVO
    wind_farm_id: "", // <-- NUEVO
  });

  // Estados para mostrar proyectos existentes
  const [existingProjects, setExistingProjects] = useState([]);

  // Estados para edición
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

  // Estados para eliminación
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState("");

  useEffect(() => {
    getCurrentUser();
  }, []);

  useEffect(() => {
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

    fetchCatalogs();
  }, []);

  useEffect(() => {
    const adminStatus = isAdmin();
    setIsUserAdmin(adminStatus);
  }, [role, isAdmin]);

  useEffect(() => {
    if (currentUser && role) {
      fetchExistingProjects();
    }
  }, [currentUser, role, isUserAdmin]);

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

  const fetchExistingProjects = async () => {
    try {
      setProjectsLoading(true);

      const filteredProjects = await fetchFilteredProjects(currentUser, role);
      const droneProjects = filteredProjects.filter(
        (p) => p.project_type === "DRONE" || !p.project_type,
      );

      setExistingProjects(droneProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast({
        title: tx("Error al cargar proyectos"),
        description: t("projects.couldNotLoadProjects"),
        variant: "destructive",
      });
      setExistingProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  };

  const addStaffMember = () => {
    if (!newStaff.user_id || !newStaff.role) {
      toast({
        title: t("projects.requiredFields"),
        description: tx("Elige a una persona registrada y su rol"),
        variant: "destructive",
      });
      return;
    }

    // Validar que la persona no esté ya en el proyecto actual
    const emailExistsInCurrentProject = staffList.some(
      (staff) => staff.user_id === newStaff.user_id || (staff.email && staff.email.toLowerCase() === newStaff.email.toLowerCase()),
    );
    if (emailExistsInCurrentProject) {
      toast({
        title: t("projects.emailDuplicate"),
        description: t("projects.technicianAlreadyAdded"),
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

    toast({
      title: t("projects.staffAdded"),
      description: `${newStaff.fullName} ${t("projects.addedToProject")}`,
    });
  };

  const removeStaffMember = (id) => {
    const staffToRemove = staffList.find((staff) => staff.id === id);
    setStaffList((prev) => prev.filter((staff) => staff.id !== id));
    toast({
      title: t("projects.staffRemoved"),
      description: `${staffToRemove?.fullName || ""} ${t(
        "projects.removedFromProject",
      )}`,
    });
  };

  // Funciones para edición
  const openEditModal = (project) => {
    setEditingProject(project);
    setEditForm({
      name: project.name,
      wind_farm: project.wind_farm,
      client: project.client,
      status: project.status,
      park_manager: project.park_manager || "",
      park_manager_email: project.park_manager_email || "",
      technical_lead: project.technical_lead || "",
      technical_lead_email: project.technical_lead_email || "",
      turbine_count: project.turbine_count.toString(),
      turbine_model: project.turbine_model || "",
      review_personnel: project.review_personnel || "",
      review_personnel_email: project.review_personnel_email || "",
      start_date: project.start_date ? new Date(project.start_date) : null,
      end_date: project.end_date ? new Date(project.end_date) : null,
    });
    setEditStaffList(project.staff || []);
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
    setEditNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });
  };

  const addEditStaffMember = () => {
    if (!editNewStaff.user_id || !editNewStaff.role) {
      toast({
        title: t("projects.requiredFields"),
        description: tx("Elige a una persona registrada y su rol"),
        variant: "destructive",
      });
      return;
    }

    // Validar que la persona no esté ya en el proyecto actual
    const emailExistsInCurrentProject = editStaffList.some(
      (staff) => staff.user_id === editNewStaff.user_id || (staff.email && staff.email.toLowerCase() === editNewStaff.email.toLowerCase()),
    );
    if (emailExistsInCurrentProject) {
      toast({
        title: t("projects.emailDuplicate"),
        description: t("projects.technicianAlreadyInTeam"),
        variant: "destructive",
      });
      return;
    }

    const newStaffMember = {
      ...editNewStaff,
      id: Date.now(), // ID temporal para nuevos miembros
      full_name: editNewStaff.fullName,
      isNew: true, // Marcar como nuevo para distinguir en la actualización
    };

    setEditStaffList((prev) => [...prev, newStaffMember]);
    setEditNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });

    toast({
      title: t("projects.staffAdded"),
      description: `${editNewStaff.fullName} ${t("projects.addedToTeam")}`,
    });
  };

  const removeEditStaffMember = (staffToRemove) => {
    setEditStaffList((prev) =>
      prev.filter((staff) => staff.id !== staffToRemove.id),
    );
  };

  const openDeleteDialog = () => {
    setProjectToDelete(editingProject);
    setShowDeleteDialog(true);
  };

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setProjectToDelete(null);
    setDeleteProgress("");
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setDeleteLoading(true);

    try {
      const result = await deleteProjectCascade(
        projectToDelete,
        (progress) => {
          setDeleteProgress(progress);
        },
        t,
      );

      toast({
        title: t("projects.projectDeletedTitle"),
        description: t("projects.projectDeletedDesc", {
          name: projectToDelete.name,
        }),
      });

      // Cerrar modal y recargar proyectos
      closeDeleteDialog();
      closeEditModal();
      fetchExistingProjects();
    } catch (error) {
      console.error("Error eliminando proyecto:", error);
      toast({
        title: t("projects.projectDeleteErrorTitle"),
        description: t("projects.projectDeleteErrorDesc", {
          error: error.message || t("projects.projectDeleteErrorGeneric"),
        }),
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setEditLoading(true);

    try {
      // Validar campos requeridos
      if (
        !editForm.name ||
        !editForm.wind_farm ||
        !editForm.client ||
        !editForm.turbine_count
      ) {
        throw new Error(t("projects.fillRequiredProjectFields"));
      }

      // Validar que hay al menos una persona en el equipo
      if (editStaffList.length === 0) {
        throw new Error(t("projects.projectMustHaveMember"));
      }

      // Validar emails únicos dentro del proyecto (no globalmente)
      const emailsInProject = editStaffList.map((staff) => staff.email);
      const uniqueEmails = new Set(emailsInProject);
      if (emailsInProject.length !== uniqueEmails.size) {
        throw new Error(t("projects.noDuplicateEmails"));
      }

      // Actualizar el proyecto
      const { error: projectError } = await updateProject(editingProject.id, {
          name: editForm.name,
          wind_farm: editForm.wind_farm,
          client: editForm.client,
          status: editForm.status,
          park_manager: editForm.park_manager || null,
          park_manager_email: editForm.park_manager_email?.trim() || null,
          technical_lead: editForm.technical_lead || null,
          technical_lead_email: editForm.technical_lead_email?.trim() || null,
          turbine_count: parseInt(editForm.turbine_count),
          turbine_model: editForm.turbine_model || null,
          review_personnel: editForm.review_personnel || null,
          review_personnel_email:
            editForm.review_personnel_email?.trim() || null,
          start_date: editForm.start_date?.toISOString(),
          end_date: editForm.end_date?.toISOString(),
          staff_list: editStaffList,
          updated_at: new Date().toISOString(),
        });

      if (projectError) {
        throw projectError;
      }

      if (projectError) {
        throw projectError;
      }

      // Sync with project_access could happen here if we matched emails to user_profiles
      // For now, we rely on staff_list for display

      toast({
        title: t("projects.projectUpdatedTitle"),
        description: t("projects.projectUpdatedDesc", { name: editForm.name }),
      });

      // Cerrar modal y recargar proyectos
      closeEditModal();
      fetchExistingProjects();
    } catch (error) {
      console.error("Error actualizando proyecto:", error);
      let errorMessage = tx("No se pudo actualizar el proyecto.");

      if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: t("projects.errorUpdatingProject"),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleSubmitProject = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar campos requeridos
      if (!projectName || !windFarm || !client || !turbineCount) {
        throw new Error(t("projects.fillRequiredProjectFields"));
      }

      // Validar que hay al menos una persona en el equipo
      if (staffList.length === 0) {
        throw new Error(t("projects.projectMustHaveMember"));
      }

      // Iniciar transacción: crear proyecto primero
      const { data: project, error: projectError } = await insertProjectReturning([
          {
            name: projectName,
            wind_farm: windFarm,
            client: client,
            status: projectStatus,
            project_type: "DRONE",
            park_manager: parkManager || null,
            park_manager_email: parkManagerEmail?.trim() || null,
            technical_lead: technicalLead || null,
            technical_lead_email: technicalLeadEmail?.trim() || null,
            turbine_count: parseInt(turbineCount),
            turbine_model: turbineModel || null,
            start_date: startDate?.toISOString(),
            end_date: endDate?.toISOString(),
            review_personnel: reviewPersonnel || null,
            review_personnel_email: reviewPersonnelEmail?.trim() || null,
            staff_list: staffList, // Guardar personal en JSONB
            created_at: new Date().toISOString(),
          },
        ]);

      if (projectError) {
        throw projectError;
      }

      // Asignar al creador como ADMIN del proyecto en project_access
      if (currentUser) {
        const { error: accessError } = await supabase
          .from("project_access")
          .insert({
            project_id: project.id,
            user_id: currentUser.id,
            role: "admin",
          });

        if (accessError)
          console.error("Error granting project admin access:", accessError);
      }

      toast({
        title: t("projects.projectCreatedTitle"),
        description: t("projects.projectCreatedDesc", {
          name: projectName,
          count: staffList.length,
          members: t("projects.members_other"),
        }),
      });

      // Limpiar formulario
      resetForm();

      // Recargar proyectos existentes
      fetchExistingProjects();
    } catch (error) {
      console.error("Error creando proyecto:", error);
      toast({
        title: t("projects.errorCreatingProject"),
        description: error.message || t("projects.errorCreatingProjectDesc"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProjectName("");
    setWindFarm("");
    setClient("");
    setProjectStatus("Planeación");
    setParkManager("");
    setParkManagerEmail("");
    setTechnicalLead("");
    setTechnicalLeadEmail("");
    setTurbineCount("");
    setTurbineModel("");
    setReviewPersonnel("");
    setReviewPersonnelEmail("");
    setStartDate(undefined);
    setEndDate(undefined);
    setStaffList([]);
    setNewStaff({
      fullName: "",
      role: "",
      email: "",
      client_id: "",
      wind_farm_id: "",
    });
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
    wind_farm: windFarm,
    client,
    turbine_count: turbineCount,
    turbine_model: turbineModel,
    status: projectStatus,
    park_manager: parkManager,
    park_manager_email: parkManagerEmail,
    technical_lead: technicalLead,
    technical_lead_email: technicalLeadEmail,
    review_personnel: reviewPersonnel,
    review_personnel_email: reviewPersonnelEmail,
    start_date: startDate,
    end_date: endDate,
  };
  const createSetters = {
    name: setProjectName,
    wind_farm: setWindFarm,
    client: setClient,
    turbine_count: setTurbineCount,
    turbine_model: setTurbineModel,
    status: setProjectStatus,
    park_manager: setParkManager,
    park_manager_email: setParkManagerEmail,
    technical_lead: setTechnicalLead,
    technical_lead_email: setTechnicalLeadEmail,
    review_personnel: setReviewPersonnel,
    review_personnel_email: setReviewPersonnelEmail,
    start_date: setStartDate,
    end_date: setEndDate,
  };

  const searchQuery = listSearch.trim().toLowerCase();
  const visibleProjects = existingProjects.filter((p) => {
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      [p.name, p.client, p.wind_farm].some((v) => (v || "").toLowerCase().includes(searchQuery));
    return matchesStatus && matchesSearch;
  });

  return (
    <PageGuard allowedRoles={["admin", "dev"]}>
      <MotionConfig reducedMotion="user">
        <Helmet>
          <title>{t("projects.title")} - VINDGROUP</title>
          <meta name="description" content={t("projects.pageSubtitle")} />
        </Helmet>

        <div className="min-h-[calc(100vh-4rem)] w-full bg-background p-4 text-ink sm:p-8">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Encabezado */}
            <Reveal>
              <PageHeader
                icon={<FolderKanban size={24} />}
                overline={tx("Gestión de activos eólicos")}
                title={t("projects.title")}
                description={t("projects.pageSubtitle")}
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
                  aria-controls="create-project-panel"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5 ${FOCUS} focus-visible:ring-inset focus-visible:ring-offset-0`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand/30 bg-brand/10 text-brand">
                      <Plus size={20} />
                    </span>
                    <span className="min-w-0">
                      <span id="create-title" className="block text-base font-semibold text-ink">{t("projects.newProject")}</span>
                      <span className="block text-xs text-ink-muted">{t("projects.formDescription")}</span>
                    </span>
                  </span>
                  <ChevronDown size={20} aria-hidden="true" className={`shrink-0 text-ink-muted transition-transform ${createOpen ? "rotate-180" : ""}`} />
                </button>

                {createOpen && (
                  <form
                    id="create-project-panel"
                    onSubmit={handleSubmitProject}
                    className="space-y-4 border-t border-line-subtle p-4 sm:p-5"
                  >
                    <ProjectFields
                      windFarms={windFarms}
                      idPrefix="create"
                      values={createValues}
                      onChange={(key, value) => createSetters[key](value)}
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
                      emptyHint={t("projects.needAtLeastOneMember")}
                    />

                    <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-4 sm:flex-row sm:justify-end">
                      <button type="button" onClick={resetForm} className={BTN_SECONDARY}>
                        <RotateCcw size={15} aria-hidden="true" />
                        {tx("Limpiar formulario")}
                      </button>
                      <button type="submit" disabled={loading} className={`${BTN_PRIMARY} sm:min-w-[220px]`}>
                        {loading ? (
                          <>
                            <Loader size={16} className="animate-spin text-ink" aria-hidden="true" />
                            {t("projects.creatingProject")}
                          </>
                        ) : (
                          <>
                            <Plus size={16} aria-hidden="true" />
                            {t("projects.createFullProject")}
                          </>
                        )}
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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 id="existing-title" className={OVERLINE}>
                      {t("projects.existingProjects")}
                      <span className="ml-2 tabular-nums text-ink-muted">
                        ({visibleProjects.length}
                        {visibleProjects.length !== existingProjects.length ? ` / ${existingProjects.length}` : ""})
                      </span>
                    </h2>
                    <p className="mt-1 text-xs text-ink-muted">{t("projects.existingProjectsDescription")}</p>
                  </div>
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
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className={INPUT}
                    >
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
                    <LoadingSpinner size="md" text={t("messages.loading")} />
                  </div>
                ) : existingProjects.length === 0 ? (
                  <EmptyState>
                    {t("projects.noProjectsYet")}
                    <span className="mt-0.5 block text-xs">{t("projects.createYourFirstProject")}</span>
                  </EmptyState>
                ) : visibleProjects.length === 0 ? (
                  <EmptyState>{tx("Ningún proyecto coincide con los filtros")}</EmptyState>
                ) : (
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visibleProjects.map((project) => (
                      <ProjectCard
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
                      <p className={OVERLINE}>{t("projects.editProject")}</p>
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
                  id="edit-project-form"
                  onSubmit={handleUpdateProject}
                  className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6"
                >
                  <ProjectFields
                    windFarms={windFarms}
                    idPrefix="edit"
                    values={editForm}
                    onChange={(key, value) => setEditForm((prev) => ({ ...prev, [key]: value }))}
                  />
                  <StaffEditor
                    idPrefix="edit-staff"
                    newStaff={editNewStaff}
                    setNewStaff={setEditNewStaff}
                    onAdd={addEditStaffMember}
                    list={editStaffList}
                    onRemove={removeEditStaffMember}
                    companies={companies}
                    windFarms={windFarms}
                    emptyHint={t("projects.projectMustHaveMember")}
                  />
                </form>

                <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-line-subtle bg-surface-panel px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <button type="button" onClick={openDeleteDialog} disabled={deleteLoading} className={BTN_DANGER}>
                    <Trash2 size={15} aria-hidden="true" />
                    {t("projects.deleteProject")}
                  </button>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row">
                    <button type="button" onClick={closeEditModal} className={BTN_SECONDARY}>
                      {t("buttons.cancel")}
                    </button>
                    <button type="submit" form="edit-project-form" disabled={editLoading} className={`${BTN_PRIMARY} sm:min-w-[180px]`}>
                      {editLoading ? (
                        <>
                          <Loader size={16} className="animate-spin text-ink" aria-hidden="true" />
                          {t("projects.updating")}
                        </>
                      ) : (
                        <>
                          <Save size={16} aria-hidden="true" />
                          {t("projects.saveChanges")}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diálogo de eliminación */}
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

export default ProjectsPage;
