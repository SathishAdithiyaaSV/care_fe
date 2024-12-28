import { useMutation } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useReducer, useState } from "react";
import { useTranslation } from "react-i18next";

import { Cancel, Submit } from "@/components/Common/ButtonV2";
import { PatientTransferRequest } from "@/components/Facility/models";
import { SelectFormField } from "@/components/Form/FormFields/SelectFormField";
import TextFormField from "@/components/Form/FormFields/TextFormField";
import { FieldChangeEvent } from "@/components/Form/FormFields/Utils";

import { OptionsType } from "@/common/constants";

import * as Notification from "@/Utils/Notifications";
import routes from "@/Utils/request/api";
import mutate from "@/Utils/request/mutate";
import { PartialPatientModel } from "@/types/emr/newPatient";

interface Props {
  patientList: Array<PartialPatientModel>;
  handleOk: () => void;
  handleCancel: () => void;
  facilityId: string;
}

const initForm = {
  patient: "",
  year_of_birth: null,
};

const initError = Object.assign(
  {},
  ...Object.keys(initForm).map((k) => ({ [k]: "" })),
);

const initialState = {
  form: { ...initForm },
  errors: { ...initError },
};

const patientFormReducer = (state = initialState, action: any) => {
  switch (action.type) {
    case "set_form": {
      return {
        ...state,
        form: action.form,
      };
    }
    case "set_error": {
      return {
        ...state,
        errors: action.errors,
      };
    }
    default:
      return state;
  }
};

const TransferPatientDialog = (props: Props) => {
  const { patientList, handleOk, handleCancel, facilityId } = props;
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [state, dispatch] = useReducer(patientFormReducer, initialState);
  const patientOptions: Array<OptionsType> = patientList.map((patient) => {
    return {
      id: patient.id,
      text: [patient.name, `(${patient.gender})`].join(" "),
    };
  });

  const maxYear = new Date().getFullYear();

  const handleChange = (e: FieldChangeEvent<unknown>) => {
    const value = String(e.value);

    if (e.name === "year_of_birth") {
      if (value.length <= 4) {
        dispatch({
          type: "set_form",
          form: { ...state.form, [e.name]: e.value },
        });
      }
    } else {
      dispatch({
        type: "set_form",
        form: { ...state.form, [e.name]: e.value },
      });
    }
  };

  const handleOnBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const yearValue = Number(state.form.year_of_birth);
    if (!state.form.year_of_birth) return;
    let errorMessage = "";
    if (yearValue > maxYear) {
      errorMessage = `Cannot be greater than ${maxYear}`;
    } else if (yearValue < 1900) {
      errorMessage = `Cannot be smaller than 1900`;
    }
    dispatch({
      type: "set_error",
      errors: {
        ...state.errors,
        [e.target.name]: errorMessage,
      },
    });
  };

  const validateForm = () => {
    const errors = { ...initError };
    let invalidForm = false;
    Object.keys(state.form).forEach((field) => {
      switch (field) {
        case "patient":
          if (!state.form[field]) {
            errors[field] = "Please select the suspect/patient";
            invalidForm = true;
          }
          return;
        case "year_of_birth":
          if (!state.form[field]) {
            errors[field] = t("field_required");
            invalidForm = true;
          }

          if (parseInt(state.form[field] || "0") > maxYear) {
            errors[field] = `Cannot be greater than ${maxYear}`;
            invalidForm = true;
          }

          if (parseInt(state.form[field] || "0") < 1900) {
            errors[field] = `Cannot be smaller than 1900`;
            invalidForm = true;
          }
          return;
        default:
          return;
      }
    });
    dispatch({ type: "set_error", errors });
    return !invalidForm;
  };

  const { mutate: transferPatient } = useMutation({
    mutationFn: (body: PatientTransferRequest) =>
      mutate(routes.searchPatient, {
        body,
      })(body),
    onSuccess: (data) => {
      dispatch({ type: "set_form", form: initForm });
      handleOk();
      const patientName =
        patientOptions.find((p) => p.id === state.form.patient)?.text || "";
      if (data.results.length > 0) {
        Notification.Success({
          msg: `Patient ${patientName} transferred successfully`,
        });

        navigate(
          `/facility/${facilityId}/patient/${data.results[0].id}/encounter`,
        );
      }
    },
    onError: (error) => {
      Notification.Error({
        msg: error?.message || "Failed to transfer patient",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const handleSubmit = async () => {
    const validForm = validateForm();
    if (validForm) {
      setIsLoading(true);
      const patient = patientList.find((p) => p.id === state.form.patient);
      if (!patient) return;

      transferPatient({
        phone_number: patient.phone_number,
        year_of_birth: String(state.form.year_of_birth),
      });
    }
  };

  return (
    <div>
      <div>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <p className="leading-relaxed">
              {t("patient_transfer_birth_match_note")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SelectFormField
              id="patient"
              name="patient"
              required
              label="Patient"
              labelClassName="text-sm"
              placeholder="Select patient"
              options={patientOptions}
              optionLabel={(patient) => patient.text}
              optionValue={(patient) => patient.id}
              optionDisabled={(patient) => patient.disabled ?? false}
              value={state.form.patient}
              onChange={handleChange}
              error={state.errors.patient}
            />
            <TextFormField
              required
              type="number"
              id="year_of_birth"
              name="year_of_birth"
              label="Year of birth"
              labelClassName="text-sm"
              value={state.form.year_of_birth}
              onChange={handleChange}
              onBlur={handleOnBlur}
              placeholder="Enter year of birth"
              error={state.errors.year_of_birth}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-2 pt-4 md:flex-row">
        <Cancel onClick={handleCancel} disabled={isLoading} />
        <Submit
          id="submit-transferpatient"
          disabled={isLoading}
          onClick={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          label="Transfer Suspect / Patient"
        />
      </div>
    </div>
  );
};

export default TransferPatientDialog;
