import os
import shutil

hub_path = r"d:\git__hub"
clinic_repo = os.path.join(hub_path, "clinica-system")
restaurant_repo = os.path.join(hub_path, "argon-system")

# Rename clinic folder
old_clinic = os.path.join(clinic_repo, "نظام العيادات")
new_clinic = os.path.join(clinic_repo, "clinic-system")

if os.path.exists(old_clinic):
    print(f"Renaming {old_clinic} to {new_clinic}")
    os.rename(old_clinic, new_clinic)
else:
    print(f"Clinic folder not found or already renamed: {old_clinic}")

# Rename restaurant folder
old_rest = os.path.join(restaurant_repo, "نظام المطاعم")
new_rest = os.path.join(restaurant_repo, "restaurant-system")

if os.path.exists(old_rest):
    print(f"Renaming {old_rest} to {new_rest}")
    os.rename(old_rest, new_rest)
else:
    print(f"Restaurant folder not found or already renamed: {old_rest}")
