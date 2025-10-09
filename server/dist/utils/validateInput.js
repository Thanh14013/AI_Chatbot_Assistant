import validator from "validator";
// Small helper regexes and limits
const NAME_REGEX = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵýỷỹ\s]+$/;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 100;
const EMAIL_MAX = 100;
// Return normalized and validated register input or throw Error
export function validateRegister(name, email, password) {
    // name
    if (!name || typeof name !== "string")
        throw new Error("Name is required");
    const normalizedName = name.trim().replace(/\s+/g, " ");
    if (normalizedName.length < 2)
        throw new Error("Name must be at least 2 characters long");
    if (normalizedName.length > 50)
        throw new Error("Name must not exceed 50 characters");
    if (!NAME_REGEX.test(normalizedName))
        throw new Error("Name can only contain letters and spaces");
    // email
    if (!email || typeof email !== "string")
        throw new Error("Email is required");
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail))
        throw new Error("Invalid email format");
    if (normalizedEmail.length > EMAIL_MAX)
        throw new Error(`Email must not exceed ${EMAIL_MAX} characters`);
    // password
    if (!password || typeof password !== "string")
        throw new Error("Password is required");
    if (password.length < PASSWORD_MIN)
        throw new Error(`Password must be at least ${PASSWORD_MIN} characters long`);
    if (password.length > PASSWORD_MAX)
        throw new Error(`Password must not exceed ${PASSWORD_MAX} characters`);
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)/;
    if (!passwordRegex.test(password))
        throw new Error("Password must contain at least 1 letter and 1 number");
    return {
        name: normalizedName,
        email: normalizedEmail,
        password,
    };
}
export function validateLogin(email, password) {
    if (!email || typeof email !== "string")
        throw new Error("Email is required");
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail))
        throw new Error("Invalid email format");
    if (!password || typeof password !== "string")
        throw new Error("Password is required");
    if (password.length < PASSWORD_MIN)
        throw new Error(`Password must be at least ${PASSWORD_MIN} characters long`);
    return { email: normalizedEmail, password };
}
export function validateChangePassword(email, oldPassword, newPassword) {
    if (!email || typeof email !== "string")
        throw new Error("Email is required");
    const normalizedEmail = email.toLowerCase().trim();
    if (!validator.isEmail(normalizedEmail))
        throw new Error("Invalid email format");
    if (!oldPassword || typeof oldPassword !== "string")
        throw new Error("Current password is required");
    if (!newPassword || typeof newPassword !== "string")
        throw new Error("New password is required");
    if (newPassword.length < PASSWORD_MIN)
        throw new Error(`New password must be at least ${PASSWORD_MIN} characters long`);
    if (newPassword.length > PASSWORD_MAX)
        throw new Error(`New password must not exceed ${PASSWORD_MAX} characters`);
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)/;
    if (!passwordRegex.test(newPassword))
        throw new Error("New password must contain at least 1 letter and 1 number");
    if (oldPassword === newPassword)
        throw new Error("New password must be different from current password");
    return {
        currentPassword: oldPassword,
        newPassword,
    };
}
export default {
    validateRegister,
    validateLogin,
    validateChangePassword,
};
