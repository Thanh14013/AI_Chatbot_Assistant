import bcrypt from "bcrypt";
// Hash password with salt
const hashPassword = async (password) => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};
// Compare password with hash
const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};
export { hashPassword, comparePassword };
