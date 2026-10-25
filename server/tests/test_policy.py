import pytest
from internpilot.policy import is_sensitive, sensitivity_level
from internpilot.schemas import Field


def _field(**kwargs) -> Field:
    defaults = dict(
        agentId="f1", frameId=0, kind="text", label="",
        labelSources=[], required=False, visible=True, disabled=False,
    )
    defaults.update(kwargs)
    return Field(**defaults)


class TestIsSensitive:
    def test_salary_is_sensitive(self):
        assert is_sensitive(_field(label="Expected Salary"))

    def test_gpa_is_sensitive(self):
        assert is_sensitive(_field(label="GPA"))
        assert is_sensitive(_field(label="CAP"))

    def test_nric_is_sensitive(self):
        assert is_sensitive(_field(label="NRIC"))
        assert is_sensitive(_field(label="Passport Number"))

    def test_work_authorization_sensitive(self):
        assert is_sensitive(_field(label="Are you authorized to work in the US?"))
        assert is_sensitive(_field(label="Work Visa Status"))

    def test_demographics_sensitive(self):
        assert is_sensitive(_field(label="Ethnicity"))
        assert is_sensitive(_field(label="Race"))
        assert is_sensitive(_field(label="Gender"))
        assert is_sensitive(_field(label="Veteran Status"))
        assert is_sensitive(_field(label="Disability Status"))

    def test_criminal_sensitive(self):
        assert is_sensitive(_field(label="Criminal Background Check"))

    def test_date_of_birth_sensitive(self):
        assert is_sensitive(_field(label="Date of Birth"))

    def test_declaration_sensitive(self):
        assert is_sensitive(_field(label="I declare that the above information is true"))

    def test_cover_letter_not_sensitive(self):
        assert not is_sensitive(_field(label="Cover Letter"))

    def test_resume_not_sensitive(self):
        assert not is_sensitive(_field(label="Resume / CV"))

    def test_portfolio_not_sensitive(self):
        assert not is_sensitive(_field(label="Portfolio URL"))

    def test_how_did_you_hear_not_sensitive(self):
        assert not is_sensitive(_field(label="How did you hear about this position?"))

    def test_willing_to_relocate_not_sensitive(self):
        assert not is_sensitive(_field(label="Are you willing to relocate?"))

    def test_first_name_not_sensitive(self):
        assert not is_sensitive(_field(label="First Name"))

    def test_email_not_sensitive(self):
        assert not is_sensitive(_field(label="Email Address"))


class TestSensitivityLevel:
    def test_textarea_is_medium(self):
        assert sensitivity_level(_field(kind="textarea", label="Cover Letter")) == "medium"

    def test_gpa_is_high(self):
        assert sensitivity_level(_field(label="GPA")) == "high"

    def test_regular_field_is_low(self):
        assert sensitivity_level(_field(label="First Name")) == "low"

    def test_salary_is_high(self):
        assert sensitivity_level(_field(label="Expected Salary")) == "high"
