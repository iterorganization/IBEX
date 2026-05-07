from typing import List


def path_in_filled_paths(node_path: str, filled_paths: List[str]):
    """
    Returns true if node path is in filled paths.
    Checks also for intermediate paths e.g. node_path = 'profiles_2d' filled_paths = ['profiles_2d/t_i_average'] should also return True.
    :param node_path: single node path e.g 'time', 'ids_properties/comment'
    :param filled_paths: list of filled paths extracted from imas.DBEntry.list_filled_paths()
    :return: True or False
    """

    node_path = node_path.rstrip("/")

    for path in filled_paths:
        path = path.rstrip("/")

        # exact match
        if path == node_path:
            return True

        # node_path is a prefix for full path
        if path.startswith(node_path + "/"):
            return True

    return False
