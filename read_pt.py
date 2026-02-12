import torch

file_path = "./test/averaged.pt"
# Load the model state dictionary
model_state_dict = torch.load(file_path)

# Print the keys to see what's inside
print(model_state_dict['cache'])

file_path = "./test/k_c.pt"
# Load the model state dictionary
model_state_dict = torch.load(file_path)

# Print the keys to see what's inside
print(model_state_dict['cache'])