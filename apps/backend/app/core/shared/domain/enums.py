import enum

class UserRole(str, enum.Enum):
    PRINCIPAL = "PRINCIPAL"
    VICE_PRINCIPAL = "VICE_PRINCIPAL"
    COORDINATOR = "COORDINATOR"
    ADMINISTRATOR = "ADMINISTRATOR"
    CLASS_TEACHER = "CLASS_TEACHER"
    SUBJECT_TEACHER = "SUBJECT_TEACHER"
    TEMP_TEACHER = "TEMP_TEACHER"
    INTERN = "INTERN"
    OFFICE_STAFF = "OFFICE_STAFF"

class DayOfWeek(str, enum.Enum):
    MON = "MON"
    TUE = "TUE"
    WED = "WED"
    THU = "THU"
    FRI = "FRI"
    SAT = "SAT"

class SubstitutionStatus(str, enum.Enum):
    PENDING = "PENDING"
    REQUESTED = "REQUESTED"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

class SwapStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"

class BloodGroup(str, enum.Enum):
    A_POS = "A_POS"
    A_NEG = "A_NEG"
    B_POS = "B_POS"
    B_NEG = "B_NEG"
    O_POS = "O_POS"
    O_NEG = "O_NEG"
    AB_POS = "AB_POS"
    AB_NEG = "AB_NEG"

class AttendanceStatus(str, enum.Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    EXCUSED = "EXCUSED"
    HALF_DAY = "HALF_DAY"
